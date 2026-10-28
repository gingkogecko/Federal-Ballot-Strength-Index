#!/usr/bin/env python3
"""Build site/data.json from the forecast TSVs and 2024 vote CSVs in data/.

Update workflow: replace data/house_forecast.tsv and data/senate_forecast.tsv
(columns: cd|state, matchup, raw_prediction, win_prob_d), then run:  python3 build.py
raw_prediction is the forecast margin in points, negative = Democratic lead
(e.g. -4.1 means D+4.1). win_prob_d is the Democratic win probability in percent.
"""
import csv, json, sys, datetime

def read_tsv(p):
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))

def read_csv(p):
    with open(p, encoding="utf-8") as f:
        return list(csv.DictReader(f))

cd_votes = {r["district"]: int(r["total_votes_2024"]) for r in read_csv("data/pres2024_by_cd_2026_lines.csv")}
st_votes = {r["state"]: int(r["total_votes_2024"]) for r in read_csv("data/pres2024_by_state_fec.csv")}

house = []
for r in read_tsv("data/house_forecast.tsv"):
    cd = r["cd"]
    if cd not in cd_votes:
        sys.exit(f"missing votes for {cd}")
    house.append({"id": cd, "state": cd.split("-")[0], "matchup": r["matchup"],
                  "mu": -float(r["raw_prediction"]) / 100.0,
                  "p": float(r["win_prob_d"]) / 100.0, "T": cd_votes[cd]})

senate = []
for r in read_tsv("data/senate_forecast.tsv"):
    st = r["state"]
    if st not in st_votes:
        sys.exit(f"missing votes for {st}")
    senate.append({"id": st, "state": st, "matchup": r["matchup"],
                   "mu": -float(r["raw_prediction"]) / 100.0,
                   "p": float(r["win_prob_d"]) / 100.0, "T": st_votes[st]})

out = {"built": datetime.date.today().isoformat(), "house": house, "senate": senate}
with open("site/data.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"house={len(house)} senate={len(senate)}")
