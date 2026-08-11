"""
Final light polish on residual weak names before 2D room work:
- Sky SPECIAL COLOUR spreads → "Special Colour"
- Sky pages with no code keep placeholder (honest)
- Refresh weak CSVs from structured JSON
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(p):
    return json.loads((ROOT / p).read_text(encoding="utf-8"))


def save(p, data):
    (ROOT / p).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def main():
    # --- Sky ---
    sky = load("scripts/sky12x18-catalogue-structured.json")
    fixed = 0
    for p in sky["products"]:
        raw = (p.get("nameOcrRaw") or "") + " " + (p.get("name") or "")
        if re.search(r"SPECIAL\s*COLOUR", raw, re.I):
            if p.get("name") != "Special Colour":
                p["name"] = "Special Colour"
                p["confidence"] = "medium"
                fixed += 1
        # 74-HIME junk clear
        if (p.get("name") or "").upper().replace(" ", "-") in {"74-HIME", "HIME"}:
            p["name"] = ""
            p["confidence"] = "placeholder"

    sky["named"] = sum(1 for p in sky["products"] if p.get("name"))
    sky["highConfidence"] = sum(
        1 for p in sky["products"] if p.get("confidence") in ("high", "medium") and p.get("name")
    )
    save("scripts/sky12x18-catalogue-structured.json", sky)
    print(f"[sky] special-colour labels: {fixed}; named={sky['named']}")

    # Refresh sky weak csv
    weak = [
        p
        for p in sky["products"]
        if not p.get("name")
        or p.get("confidence") == "placeholder"
        or re.match(r"^Sky 12x18 Concept", p.get("name") or "")
    ]
    with (ROOT / "scripts/sky12x18-weak-slots-remaining.csv").open(
        "w", newline="", encoding="utf-8"
    ) as f:
        w = csv.DictWriter(
            f,
            fieldnames=["id", "name", "sizeMm", "finish", "pdfPage", "textureUrl"],
            extrasaction="ignore",
        )
        w.writeheader()
        for p in weak:
            m = re.search(r"c(\d+)", p["id"])
            num = int(m.group(1)) if m else 0
            label = p.get("name") or f"Sky 12x18 Concept #{num}"
            w.writerow(
                {
                    "id": p["id"],
                    "name": label,
                    "sizeMm": p.get("sizeMm"),
                    "finish": p.get("finish"),
                    "pdfPage": p.get("pdfPage"),
                    "textureUrl": p.get("textureUrl"),
                }
            )
    print(f"[sky] weak remaining: {len(weak)}")

    # Mark medium Special Colour as high for apply (isGoodName needs to accept it)
    print("Done polish. Re-run apply_sky12x18_catalogue.mjs")


if __name__ == "__main__":
    main()
