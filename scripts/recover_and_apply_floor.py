import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "scripts" / "floor-catalogue-structured.json"
CATALOGUE = ROOT / "src" / "data" / "importedCatalogue.js"
CALC = ROOT / "src" / "data" / "floorSizeCalculator.json"
WEAK_CSV = ROOT / "scripts" / "floor-weak-slots-remaining.csv"

data = json.loads(JSON_PATH.read_text(encoding="utf-8"))

# Manual recoveries where OCR string was known-good earlier or parseable
force = {
    "gt-floor-c006": "G-15032",
    "gt-floor-c007": "G-15741",
    "gt-floor-c027": "G-15726",
    "gt-floor-c082": "15001 Plain White",
}

for p in data["products"]:
    if p["id"] in force:
        p["name"] = force[p["id"]]
        p["confidence"] = "high"
        print("force", p["id"], p["name"])

# Re-score: anything that is still placeholder with a real name in nameOcrFailed
# that matches NAME (Finish) pattern
pat = re.compile(
    r"([A-Z][A-Za-z0-9 \-]{2,40}?)\s*\(\s*(Glossy|Matte|Matt|Carving|Satin)\s*\)",
    re.I,
)
for p in data["products"]:
    if p.get("confidence") == "high":
        continue
    raw = p.get("nameOcrRaw") or p.get("nameOcrFailed") or ""
    m = pat.search(raw)
    if m:
        name = " ".join(w.title() for w in m.group(1).split())
        if len(name) >= 3:
            p["name"] = name
            p["finish"] = m.group(2).title().replace("Matt", "Matte")
            p["confidence"] = "high"
            print("from raw", p["id"], name)

# Ensure all slots have a name
for p in data["products"]:
    if not p.get("name") or p.get("confidence") not in ("high", "placeholder", "skip"):
        num = int(re.search(r"(\d+)$", p["id"]).group(1))
        p["name"] = f"Global Floor Tile #{num}"
        p["confidence"] = "placeholder"
    if p.get("confidence") != "high" and not str(p.get("name", "")).startswith("Global Floor"):
        # if not high and not already placeholder pattern, check quality
        n = p["name"]
        if re.match(r"^[A-Za-z0-9][A-Za-z0-9 \-]{2,40}$", n) and sum(c.isalpha() for c in n) >= 3:
            # leave
            if "Global Floor Tile" not in n and not re.search(r"[\\|_=]{2,}", n):
                singles = sum(1 for w in n.split() if len(w) == 1)
                if singles < 2:
                    p["confidence"] = "high"

high = [p for p in data["products"] if p.get("confidence") == "high"]
ph = [p for p in data["products"] if p.get("confidence") == "placeholder"]
print(f"high={len(high)} placeholder={len(ph)}")

JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

# Apply all names/sizes/finishes to catalogue
src = CATALOGUE.read_text(encoding="utf-8")
for p in data["products"]:
    pid = p["id"]
    name = p["name"].replace('"', "'")
    src = re.sub(
        rf'("id":\s*"{pid}",\s*\n\s*"name":\s*")([^"]*)(")',
        rf"\g<1>{name}\g<3>",
        src,
        count=1,
    )
    if p.get("sizeMm"):
        src = re.sub(
            rf'("id":\s*"{pid}"[\s\S]*?"size":\s*")([^"]*)(")',
            rf"\g<1>{p['sizeMm']}\g<3>",
            src,
            count=1,
        )
    if p.get("finish"):
        src = re.sub(
            rf'("id":\s*"{pid}"[\s\S]*?"finish":\s*")([^"]*)(")',
            rf"\g<1>{p['finish']}\g<3>",
            src,
            count=1,
        )
CATALOGUE.write_text(src, encoding="utf-8")
print("catalogue updated")

# Weak CSV
import csv

with WEAK_CSV.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "id", "name", "sizeMm", "sizeFt", "finish", "pcsPerBox", "boxWeightKg",
            "pdfPage", "cataloguePage", "side", "textureUrl", "confidence",
        ],
    )
    w.writeheader()
    for p in sorted(ph, key=lambda x: x["id"]):
        w.writerow(
            {
                "id": p["id"],
                "name": p["name"],
                "sizeMm": p.get("sizeMm"),
                "sizeFt": p.get("sizeFt"),
                "finish": p.get("finish"),
                "pcsPerBox": p.get("pcsPerBox"),
                "boxWeightKg": p.get("boxWeightKg"),
                "pdfPage": p.get("pdfPage"),
                "cataloguePage": p.get("cataloguePage"),
                "side": p.get("side"),
                "textureUrl": p.get("textureUrl"),
                "confidence": p.get("confidence"),
            }
        )

calc = {
    "source": "scripts/floor-catalogue-structured.json",
    "count": len(data["products"]),
    "highConfidenceNames": len(high),
    "placeholderNames": len(ph),
    "sizeHistogram": {},
    "products": [
        {
            "id": p["id"],
            "name": p["name"],
            "code": p.get("code"),
            "sizeMm": p.get("sizeMm"),
            "sizeFt": p.get("sizeFt"),
            "finish": p.get("finish"),
            "pcsPerBox": p.get("pcsPerBox"),
            "boxWeightKg": p.get("boxWeightKg"),
            "surface": "Floor",
            "confidence": p.get("confidence"),
            "textureUrl": p.get("textureUrl"),
        }
        for p in data["products"]
    ],
}
for p in data["products"]:
    s = p.get("sizeMm") or "?"
    calc["sizeHistogram"][s] = calc["sizeHistogram"].get(s, 0) + 1
CALC.write_text(json.dumps(calc, indent=2, ensure_ascii=False), encoding="utf-8")

print("weak csv", WEAK_CSV)
print("sizes", calc["sizeHistogram"])
print("\n=== HIGH CONFIDENCE (all) ===")
for p in high:
    print(f"{p['id']}\t{p['name']}\t{p['sizeMm']}\t{p['finish']}\t{p.get('pcsPerBox')}pcs/{p.get('boxWeightKg')}kg")
print("\n=== PLACEHOLDER SLOTS (need human name) ===")
for p in ph:
    print(f"{p['id']}\t{p['name']}\tpdf p{p['pdfPage']} {p.get('side')}\t{p['sizeMm']}")
