"""Explainable rule engine. Prototype thresholds - NOT veterinary diagnostic values."""
# species: (temp_min, temp_max, hr_min, hr_max)
NORMAL = {"cow": (38.0, 39.5, 48, 84), "cattle": (38.0, 39.5, 48, 84), "goat": (38.5, 40.0, 70, 90),
          "sheep": (38.5, 40.0, 70, 90), "pig": (38.7, 39.8, 60, 90), "chicken": (40.6, 43.0, 250, 300)}
ACT = {"normal": 0, "low": 15, "very_low": 25}
INTAKE = {"normal": 0, "reduced": 15, "none": 25}

def evaluate(r: dict, species="cow", prev=()):
    """prev = the last two earlier temperatures, oldest first. Returns score, level, concerns, advice, breakdown."""
    tmin, tmax, hmin, hmax = NORMAL.get((species or "").lower(), NORMAL["cow"])
    bd = []
    add = lambda p, m: bd.append({"rule": m, "points": p})
    t, hr = r.get("temperature"), r.get("heart_rate")
    if t is not None:
        if t >= tmax + 0.5: add(35, f"High fever ({t}°C)")
        elif t > tmax: add(20, f"Elevated temperature ({t}°C)")
        elif t < tmin - 0.5: add(20, f"Low temperature ({t}°C)")
        if len(prev) == 2 and prev[0] < prev[1] < t and t - prev[0] >= 0.6: add(10, "Temperature rising over last 3 readings")
    if hr is not None:
        if hr > hmax * 1.3: add(20, f"Very high heart rate ({hr} bpm)")
        elif hr > hmax: add(10, f"Raised heart rate ({hr} bpm)")
        elif hr < hmin * 0.8: add(15, f"Low heart rate ({hr} bpm)")
    if ACT.get(r["activity"]): add(ACT[r["activity"]], "Reduced activity")
    if INTAKE.get(r["food_intake"]): add(INTAKE[r["food_intake"]], "Reduced food intake")
    if INTAKE.get(r["water_intake"]): add(INTAKE[r["water_intake"]] - 5, "Reduced water intake")
    for s in [x.strip() for x in (r.get("symptoms") or "").split(",") if x.strip()]: add(8, s.capitalize())
    if len(bd) >= 3: add(10, "Multiple concerns together")
    score = min(sum(b["points"] for b in bd), 100)
    level = "Healthy" if score <= 30 else "Monitor" if score <= 60 else "At Risk" if score <= 80 else "High Risk"
    return score, level, [b["rule"] for b in bd], RECS[level], bd

RECS = {
 "Healthy": "No action needed. Continue routine observation.",
 "Monitor": "Re-check temperature, appetite and activity within 12-24 hours. Keep the animal observed.",
 "At Risk": "Isolate if symptoms spread, increase monitoring to every few hours, ensure water and shade, and consult a veterinarian.",
 "High Risk": "Increase monitoring, isolate the animal and seek veterinary assessment where appropriate.",
}
