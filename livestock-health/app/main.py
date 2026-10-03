import os, random, datetime as dt
import bcrypt, jwt
from typing import Optional, Literal
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import NullPool
from .rules import evaluate

URL = os.getenv("DATABASE_URL", "sqlite:///./livestock.db").replace("postgres://", "postgresql://")
SECRET = os.getenv("JWT_SECRET", "dev-secret")
engine = create_engine(URL, poolclass=NullPool)  # NullPool suits serverless
Session_ = sessionmaker(engine)
Base = declarative_base()
now = lambda: dt.datetime.utcnow()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True); username = Column(String, unique=True); pw = Column(String)
class Animal(Base):
    __tablename__ = "animals"
    animal_id = Column(String, primary_key=True); species = Column(String); breed = Column(String)
    age = Column(Float); gender = Column(String); farm_id = Column(String, default="farm1")
class HealthRecord(Base):
    __tablename__ = "health_records"
    record_id = Column(Integer, primary_key=True); animal_id = Column(String, ForeignKey("animals.animal_id"))
    temperature = Column(Float); heart_rate = Column(Float); activity = Column(String)
    food_intake = Column(String); water_intake = Column(String); symptoms = Column(Text, default="")
    risk_score = Column(Integer); risk_level = Column(String); source = Column(String, default="manual"); timestamp = Column(DateTime, default=now)
class Alert(Base):
    __tablename__ = "alerts"
    alert_id = Column(Integer, primary_key=True); animal_id = Column(String); risk_score = Column(Integer)
    risk_level = Column(String); message = Column(Text); status = Column(String, default="open")
    timestamp = Column(DateTime, default=now)
class VetRecord(Base):
    __tablename__ = "veterinary_records"
    record_id = Column(Integer, primary_key=True); animal_id = Column(String); assessment = Column(Text)
    recommendation = Column(Text); follow_up_date = Column(String); timestamp = Column(DateTime, default=now)
Base.metadata.create_all(engine)
from sqlalchemy import inspect, text
if "source" not in [c["name"] for c in inspect(engine).get_columns("health_records")]:  # upgrade older databases
    with engine.begin() as c: c.execute(text("ALTER TABLE health_records ADD COLUMN source VARCHAR DEFAULT 'manual'"))

app = FastAPI(title="Livestock Health API")
bearer = HTTPBearer()
def db():
    with Session_() as s: yield s
def user(c: HTTPAuthorizationCredentials = Depends(bearer)):
    try: return jwt.decode(c.credentials, SECRET, algorithms=["HS256"])["sub"]
    except Exception: raise HTTPException(401, "Invalid token")
def row(o): return {c.name: getattr(o, c.name) for c in o.__table__.columns}

class Cred(BaseModel): username: str; password: str
class AnimalIn(BaseModel): animal_id: str; species: str; breed: str = ""; age: float = Field(0, ge=0, le=60); gender: str = ""
class HealthIn(BaseModel):
    temperature: Optional[float] = Field(None, ge=30, le=45); heart_rate: Optional[float] = Field(None, ge=10, le=300)
    activity: Literal["normal", "low", "very_low"] = "normal"; food_intake: Literal["normal", "reduced", "none"] = "normal"
    water_intake: Literal["normal", "reduced", "none"] = "normal"; symptoms: str = Field("", max_length=200); source: str = "manual"
class VetIn(BaseModel): assessment: str; recommendation: str = ""; follow_up_date: str = ""

def token(u): return {"token": jwt.encode({"sub": u, "exp": now() + dt.timedelta(days=1)}, SECRET)}
@app.post("/api/auth/register")
def register(c: Cred, s: Session = Depends(db)):
    if s.query(User).filter_by(username=c.username).first(): raise HTTPException(400, "Username taken")
    s.add(User(username=c.username, pw=bcrypt.hashpw(c.password.encode(), bcrypt.gensalt()).decode())); s.commit()
    return token(c.username)
@app.post("/api/auth/login")
def login(c: Cred, s: Session = Depends(db)):
    u = s.query(User).filter_by(username=c.username).first()
    if not u or not bcrypt.checkpw(c.password.encode(), u.pw.encode()): raise HTTPException(401, "Wrong credentials")
    return token(c.username)

def latest(s, aid): return s.query(HealthRecord).filter_by(animal_id=aid).order_by(HealthRecord.record_id.desc()).first()
@app.post("/api/animals")
def add_animal(a: AnimalIn, s: Session = Depends(db), _=Depends(user)):
    if s.get(Animal, a.animal_id): raise HTTPException(400, "Animal ID exists")
    s.add(Animal(**a.model_dump())); s.commit(); return a
@app.get("/api/animals")
def animals(s: Session = Depends(db), _=Depends(user)):
    out = []
    for a in s.query(Animal).all():
        l = latest(s, a.animal_id); out.append({**row(a), "risk_level": l.risk_level if l else "No data", "risk_score": l.risk_score if l else None})
    return out
@app.put("/api/animals/{aid}")
def edit_animal(aid: str, a: AnimalIn, s: Session = Depends(db), _=Depends(user)):
    o = s.get(Animal, aid)
    if not o: raise HTTPException(404, "Animal not found")
    for k, v in a.model_dump(exclude={"animal_id"}).items(): setattr(o, k, v)
    s.commit(); return row(o)

def record(s, aid, h: HealthIn):
    if not s.get(Animal, aid): raise HTTPException(404, "Animal not found")
    prev = [x.temperature for x in reversed(s.query(HealthRecord).filter_by(animal_id=aid).order_by(HealthRecord.record_id.desc()).limit(2).all()) if x.temperature is not None]
    score, level, concerns, rec, bd = evaluate(h.model_dump(), s.get(Animal, aid).species, prev)
    r = HealthRecord(animal_id=aid, **h.model_dump(), risk_score=score, risk_level=level); s.add(r)
    if level in ("At Risk", "High Risk"):
        s.add(Alert(animal_id=aid, risk_score=score, risk_level=level, message="; ".join(concerns)))
    s.commit()
    return {**row(r), "concerns": concerns, "breakdown": bd, "recommendation": rec}
@app.post("/api/animals/{aid}/health")
def add_health(aid: str, h: HealthIn, s: Session = Depends(db), _=Depends(user)): return record(s, aid, h)
def fake(mode):
    sick = mode == "sick" or (mode == "random" and random.random() < 0.5)
    return HealthIn(temperature=round(random.uniform(39.8, 41) if sick else random.uniform(38, 39.3), 1),
        heart_rate=random.randint(95, 120) if sick else random.randint(55, 80),
        activity=random.choice(["low", "very_low"]) if sick else "normal",
        food_intake="reduced" if sick else "normal", water_intake="normal",
        symptoms="lethargy" if sick else "", source="simulated")
@app.post("/api/animals/{aid}/simulate")
def simulate(aid: str, mode: str = "random", s: Session = Depends(db), _=Depends(user)):
    return record(s, aid, fake(mode))
@app.post("/api/simulate-all")
def simulate_all(s: Session = Depends(db), _=Depends(user)):
    ids = [a.animal_id for a in s.query(Animal).all()]
    for i in ids: record(s, i, fake("random"))
    return {"updated": len(ids)}
@app.get("/api/animals/{aid}/history")
def history(aid: str, s: Session = Depends(db), _=Depends(user)):
    return {"health": [row(r) for r in s.query(HealthRecord).filter_by(animal_id=aid).order_by(HealthRecord.record_id)],
            "vet": [row(r) for r in s.query(VetRecord).filter_by(animal_id=aid).order_by(VetRecord.record_id.desc())]}
@app.post("/api/animals/{aid}/vet")
def vet(aid: str, v: VetIn, s: Session = Depends(db), _=Depends(user)):
    s.add(VetRecord(animal_id=aid, **v.model_dump()))
    for a in s.query(Alert).filter_by(animal_id=aid, status="open"): a.status = "resolved"
    s.commit(); return {"ok": True}
@app.get("/api/alerts")
def alerts(s: Session = Depends(db), _=Depends(user)):
    return [row(a) for a in s.query(Alert).order_by(Alert.alert_id.desc()).limit(50)]
@app.get("/api/dashboard")
def dashboard(s: Session = Depends(db), _=Depends(user)):
    c = {"Healthy": 0, "Monitor": 0, "At Risk": 0, "High Risk": 0, "No data": 0}
    for a in s.query(Animal).all():
        l = latest(s, a.animal_id); c[l.risk_level if l else "No data"] += 1
    today, due = dt.date.today().isoformat(), []
    for v in s.query(VetRecord).filter(VetRecord.follow_up_date != "", VetRecord.follow_up_date <= today):
        if not s.query(HealthRecord).filter(HealthRecord.animal_id == v.animal_id, HealthRecord.timestamp > v.timestamp).first():
            due.append({"animal_id": v.animal_id, "follow_up_date": v.follow_up_date})
    return {"total": sum(c.values()), **c, "open_alerts": s.query(Alert).filter_by(status="open").count(), "due_followups": due}

@app.delete("/api/animals/{aid}")
def delete_animal(aid: str, s: Session = Depends(db), _=Depends(user)):
    for m in (HealthRecord, Alert, VetRecord): s.query(m).filter_by(animal_id=aid).delete()
    s.query(Animal).filter_by(animal_id=aid).delete(); s.commit(); return {"ok": True}

N = "normal"
DEMO = {  # animal: (species, breed, age, [(days_ago, temp, hr, activity, food, water, symptoms)])
 "COW001": ("Cow", "Holstein", 4, [(6, 38.6, 65, N, N, N, ""), (4, 39.7, 70, "low", N, N, ""), (3, 39.8, 95, "low", "reduced", N, ""), (2, 40.2, 105, "low", "reduced", N, "lethargy"), (0, 38.9, 70, N, N, N, "")]),
 "GOAT001": ("Goat", "Boer", 2, [(5, 39.0, 80, N, N, N, ""), (2, 39.2, 82, N, N, N, ""), (0, 39.1, 80, N, N, N, "")]),
 "COW002": ("Cow", "Jersey", 3, [(4, 38.8, 66, N, N, N, ""), (2, 39.3, 72, N, N, N, ""), (1, 39.7, 80, "low", N, N, ""), (0, 40.1, 96, "low", "reduced", "reduced", "cough")]),
}
@app.post("/api/demo")
def demo(s: Session = Depends(db), _=Depends(user)):
    for aid, (sp, br, age, rows) in DEMO.items():
        if s.get(Animal, aid): continue
        s.add(Animal(animal_id=aid, species=sp, breed=br, age=age, gender="F")); temps = []
        for d, t, hr, ac, fo, wa, sy in rows:
            r = dict(temperature=t, heart_rate=hr, activity=ac, food_intake=fo, water_intake=wa, symptoms=sy)
            score, level, concerns, _r, _b = evaluate(r, sp, temps[-2:]); ts = now() - dt.timedelta(days=d)
            s.add(HealthRecord(animal_id=aid, **r, risk_score=score, risk_level=level, source="simulated", timestamp=ts))
            if level in ("At Risk", "High Risk"):
                s.add(Alert(animal_id=aid, risk_score=score, risk_level=level, message="; ".join(concerns), status="resolved" if d else "open", timestamp=ts))
            temps.append(t)
    s.commit(); return {"ok": True}

@app.get("/api/health")
def health(): return {"status": "ok"}
