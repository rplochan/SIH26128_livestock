# Herd Watch: Livestock Health Early Detection & Management System

A software-only platform that helps farmers and veterinarians spot livestock health problems early, raise alerts, and track follow-up care. It uses an **explainable rule-based engine**. There is no hardware, machine learning or deep learning in this prototype.

---

## 1. Problem Statement

Livestock diseases reduce productivity, cause economic losses and create animal-welfare concerns, especially when problems are noticed late. Farmers usually rely on manual observation and occasional veterinary visits, which makes continuous monitoring difficult.

**Goal:** an efficient system for early detection, prevention and management of livestock diseases and animal health issues.

## 2. Proposed Solution

A centralized web platform where farmers or veterinarians can:

- Register and manage individual animals
- Enter health observations manually, or generate simulated readings
- Keep a history of every observation
- Analyze readings with predefined, explainable rules
- Calculate a health-risk score and classify each animal
- Receive early-warning alerts
- Get recommended management actions
- Record veterinary assessments and follow-ups

> The scoring thresholds are **prototype decision rules, not veterinary diagnostic values**. The system supports decisions; it does not replace a veterinarian.

### System flow

```
Register Animal -> Enter / Simulate Health Data -> Validate & Store
   -> Rule-Based Analysis -> Risk Score -> Risk Level
   -> Alert -> Recommendation -> Vet Follow-up -> Updated Health Record
```

## 3. How the Rule Engine Works

Implemented in `app/rules.py`. Each rule that fires adds points. The total is capped at 100, and the result panel shows every rule with its points, so every score can be explained.

| Signal | Rule | Points |
|---|---|---|
| Temperature | above species maximum + 0.5 °C | +35 |
| | above species maximum | +20 |
| | below species minimum - 0.5 °C | +20 |
| | rising across the last 3 readings (rise of 0.6 °C or more) | +10 |
| Heart rate | above 1.3 x species maximum | +20 |
| | above species maximum | +10 |
| | below 0.8 x species minimum | +15 |
| Activity | low / very low | +15 / +25 |
| Food intake | reduced / none | +15 / +25 |
| Water intake | reduced / none | +10 / +20 |
| Symptoms | each listed symptom | +8 |
| Combination | 3 or more rules fired | +10 |

**Species reference ranges (prototype values)**

| Species | Temperature (°C) | Heart rate (bpm) |
|---|---|---|
| Cow / cattle | 38.0 to 39.5 | 48 to 84 |
| Goat / sheep | 38.5 to 40.0 | 70 to 90 |
| Pig | 38.7 to 39.8 | 60 to 90 |
| Chicken | 40.6 to 43.0 | 250 to 300 |

**Risk levels**

| Score | Level | Action |
|---|---|---|
| 0 to 30 | Healthy | Continue routine observation |
| 31 to 60 | Monitor | Re-check within 12 to 24 hours |
| 61 to 80 | At Risk | Increase monitoring, isolate if symptoms spread, consult a vet |
| 81 to 100 | High Risk | Isolate and seek veterinary assessment |

Alerts are created automatically for **At Risk** and **High Risk**. Saving a vet follow-up resolves the animal's open alerts.

**Example:** COW001 with 40.2 °C, low activity, reduced food intake and lethargy scores 35 + 15 + 15 + 8 + 10 = **83, High Risk**.

## 4. Main Features

- **Animals:** add, view, search, filter by risk level, delete
- **Health data:** manual entry, or simulated readings (healthy, sick or random). Every record is labelled **Manual** or **Simulated**
- **Rule explanation:** a per-rule breakdown with points for each result
- **Alerts:** open and resolved alerts with the reasons
- **Dashboard:** total animals, counts per risk level, open alerts, follow-ups due
- **History:** risk-over-time chart and a full record list
- **Vet follow-up:** assessment, recommendation and follow-up date
- **Demo tools:** "Load demo data" and "Simulate whole herd" buttons
- **Security basics:** password hashing (bcrypt), JWT login, input validation

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Backend | Python + FastAPI |
| Rule engine | Plain Python (`app/rules.py`) |
| Database | PostgreSQL (Neon) in production; SQLite for local runs |
| ORM | SQLAlchemy 2 (psycopg2 driver) |
| Authentication | JWT (PyJWT) + bcrypt |
| API | REST under `/api/...` |
| Containers | Docker + Docker Compose (API + local Postgres) |
| Hosting | Vercel (static frontend + serverless Python API) |
| Version control | Git + GitHub |

No hardware, no ML, no DL.

## 6. Architecture

```
Farmer / Vet
    |
React + Vite dashboard
    |  /api/...
FastAPI REST API --------- Rule Engine (risk score, level, advice)
    |
PostgreSQL: users, animals, health_records, alerts, veterinary_records
```

## 7. Database Design

| Table | Main columns |
|---|---|
| `users` | id, username, password hash |
| `animals` | animal_id, species, breed, age, gender, farm_id |
| `health_records` | record_id, animal_id, temperature, heart_rate, activity, food_intake, water_intake, symptoms, risk_score, risk_level, source, timestamp |
| `alerts` | alert_id, animal_id, risk_score, risk_level, message, status, timestamp |
| `veterinary_records` | record_id, animal_id, assessment, recommendation, follow_up_date, timestamp |

## 8. API Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Create account, log in (returns JWT) |
| GET | `/api/health` | Health check |
| GET / POST | `/api/animals` | List or add animals |
| PUT / DELETE | `/api/animals/{id}` | Edit or delete an animal |
| POST | `/api/animals/{id}/health` | Submit a reading (analysed immediately) |
| POST | `/api/animals/{id}/simulate?mode=healthy\|sick\|random` | Simulated reading |
| GET | `/api/animals/{id}/history` | Health and vet history |
| POST | `/api/animals/{id}/vet` | Save vet follow-up and resolve alerts |
| GET | `/api/alerts` | Recent alerts |
| GET | `/api/dashboard` | Summary counts and follow-ups due |
| POST | `/api/simulate-all`, `/api/demo` | Simulate the herd, load demo data |

Interactive docs are available at `/docs` when running locally.

## 9. Project Structure

```
livestock-health/
├── api/index.py          Vercel entry point
├── app/
│   ├── main.py           Routes, models, auth
│   └── rules.py          Rule engine
├── frontend/
│   ├── package.json, vite.config.js, index.html
│   └── src/ (main.jsx, App.jsx, index.css)
├── tests/test_rules.py   Rule-engine tests
├── requirements.txt
├── Dockerfile, docker-compose.yml
├── vercel.json
└── .env.example
```

## 10. Run Locally

Requirements: Python 3.10+, Node.js 18+, Git.

```bash
# Terminal 1: backend (from the project root)
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload      # http://localhost:8000/docs

# Terminal 2: frontend
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Without `DATABASE_URL`, the backend uses a local SQLite file. Register an account, open Overview and click **Load demo data**.

Tests: `pip install pytest && pytest`

Optional Postgres with Docker: `docker compose up --build`

## 11. Deploy to Vercel

1. Create a free Postgres database on Neon and copy the connection string (the pooled one is best).
2. Push the project to GitHub.
3. Import the repo in Vercel. Set **Root Directory** to the folder containing `vercel.json`, and **Framework Preset** to **Other**.
4. Add environment variables:
   - `DATABASE_URL`: the Neon connection string
   - `JWT_SECRET`: a long random value (`openssl rand -hex 32`)
5. Deploy, then open `/api/health` to confirm the backend is running.

For speed, set the Vercel **Function Region** close to your Neon region. Optionally add `SKIP_DB_INIT=1` after the first successful run to skip table checks on startup.

## 12. Demo Walkthrough

1. Register and log in
2. Overview, then **Load demo data** (or add `COW001` manually)
3. Open COW001 and enter 40.2 °C, low activity, reduced food, symptom `lethargy`
4. See **High Risk (93 with a heart rate of 105)** with the rule breakdown and recommendation
5. Check Alerts and the Overview counts
6. Save a vet follow-up, which resolves the alerts
7. Enter a recovery reading and watch the history chart update

## 13. Limitations

- Thresholds are prototype rules, not veterinary diagnostics
- Data is manual or simulated; there are no sensors
- All logged-in users currently see all animals (no per-farm separation)
- No farmer/vet roles yet
- Free-tier hosting means the first request after idle time can be slow

## 14. Future Scope

Per-farm accounts and roles, edit-animal screen, vaccination and treatment log, CSV and printable reports, age and pregnancy factors in the rules, login rate-limiting, installable mobile app, and sensor integration as a later phase.
