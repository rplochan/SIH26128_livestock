from app.rules import evaluate
base = dict(temperature=38.6, heart_rate=65, activity="normal", food_intake="normal", water_intake="normal", symptoms="")

def test_healthy(): assert evaluate(base)[1] == "Healthy"
def test_high_risk():
    r = {**base, "temperature": 40.2, "activity": "low", "food_intake": "reduced", "symptoms": "lethargy", "heart_rate": None}
    assert evaluate(r)[:2] == (83, "High Risk")
def test_species_thresholds():  # 39.8C is raised for a cow but normal for a goat
    r = {**base, "temperature": 39.8}
    assert evaluate(r, "cow")[0] > 0 and evaluate(r, "goat")[0] == 0
def test_trend(): assert any("rising" in c for c in evaluate({**base, "temperature": 39.3}, "cow", [38.4, 38.8])[2])
