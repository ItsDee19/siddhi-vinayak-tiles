"""
Strict-score floor OCR names; keep only reliable ones; fill remaining slots
with stable placeholders. Rewrite CSV/JSON + apply good names to catalogue.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "scripts" / "floor-catalogue-structured.json"
CSV_PATH = ROOT / "scripts" / "floor-catalogue-structured.csv"
WEAK_CSV = ROOT / "scripts" / "floor-weak-slots-remaining.csv"
CATALOGUE = ROOT / "src" / "data" / "importedCatalogue.js"
CALC = ROOT / "src" / "data" / "floorSizeCalculator.json"

CODE_RE = re.compile(r"^[A-Z]-?\d{4,6}$", re.I)
CODE_IN = re.compile(r"\b([A-Z]-?\d{4,6})\b", re.I)
# Real product-style names: words, optional hyphen, optional finish already stripped
WORDY = re.compile(r"^[A-Za-z][A-Za-z0-9]*(?:[ \-][A-Za-z0-9]+){0,5}$")


def score_name(name: str) -> tuple[int, str]:
    """Return (score 0-100, reason). score>=60 = keep."""
    if not name:
        return 0, "empty"
    n = re.sub(r"\s+", " ", name).strip(" -•·|.,;:'\"")
    if not n:
        return 0, "empty"

    # Product codes
    if CODE_RE.match(n.replace(" ", "")):
        return 95, "code"

    # Reject obvious OCR noise
    if re.search(r"[\\|_~`^=]{1,}", n):
        return 5, "symbols"
    if re.search(r"coverage|net weight|minimum thickness|page\s*\d", n, re.I):
        return 0, "back-matter"
    letters = sum(c.isalpha() for c in n)
    digits = sum(c.isdigit() for c in n)
    if letters < 3 and not CODE_IN.search(n):
        return 10, "few-letters"

    words = n.split()
    # Too many 1-char tokens
    singles = sum(1 for w in words if len(w) == 1)
    if singles >= 2 and len(words) >= 3:
        return 15, "fragmented"

    # Looks like real product name
    if WORDY.match(n) and 3 <= len(n) <= 40:
        # Prefer multi-word or longer single word
        if len(words) >= 2:
            return 90, "wordy-multi"
        if len(n) >= 5:
            return 80, "wordy-single"
        return 50, "short-word"

    # Contains a clean code somewhere
    m = CODE_IN.search(n)
    if m and letters <= 8:
        return 85, "has-code"

    # Title-ish with some junk
    if letters >= 8 and singles <= 1 and len(n) <= 36:
        return 55, "borderline"

    return 20, "garbage"


def title_name(n: str) -> str:
    n = re.sub(r"\s+", " ", n).strip()
    if CODE_RE.match(n.replace(" ", "")):
        return n.replace(" ", "").upper()
    return " ".join(
        w.upper() if CODE_RE.match(w) else w.title() for w in n.split()
    )


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    products = data["products"]

    # Known good recoveries (manual / high-confidence from earlier passes)
    # Product codes that are the printed name
    force_good = {
        "gt-floor-c006": "G-15032",
        "gt-floor-c007": "G-15741",
        "gt-floor-c027": "G-15726",
    }

    kept = []
    weak = []

    for p in products:
        pid = p["id"]
        if pid in force_good:
            p["name"] = force_good[pid]
            p["code"] = force_good[pid]
            p["confidence"] = "high"
            p["nameScore"] = 95
            kept.append(p)
            continue

        name = (p.get("name") or "").strip()
        sc, reason = score_name(name)
        p["nameScore"] = sc
        p["nameScoreReason"] = reason

        if sc >= 60:
            p["name"] = title_name(name)
            p["confidence"] = "high"
            kept.append(p)
        else:
            # Fill slot with stable placeholder so calculator still has a row
            num = int(re.search(r"(\d+)$", pid).group(1))
            placeholder = f"Global Floor Tile #{num}"
            p["namePlaceholder"] = placeholder
            p["nameOcrFailed"] = name
            p["name"] = placeholder
            p["confidence"] = "placeholder"
            weak.append(p)

    # Back-matter pages (tech sheets)
    for p in products:
        if p["pdfPage"] >= 71:
            p["confidence"] = "skip"
            p["note"] = "catalogue back-matter / non-product layout"
            if p not in weak and p["confidence"] != "high":
                pass

    data["products"] = products
    data["namedHigh"] = len(kept)
    data["placeholder"] = len(weak)
    data["summary"] = {
        "total": len(products),
        "highConfidenceNames": len(kept),
        "placeholderSlots": len(weak),
        "sizeHistogram": {},
    }
    for p in products:
        s = p.get("sizeMm") or "?"
        data["summary"]["sizeHistogram"][s] = data["summary"]["sizeHistogram"].get(s, 0) + 1

    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    fields = [
        "id", "name", "code", "sizeMm", "sizeFt", "finish", "pcsPerBox", "boxWeightKg",
        "surface", "bodyType", "cataloguePage", "pdfPage", "variant", "side",
        "textureFile", "textureUrl", "confidence", "nameScore", "nameOcrFailed",
        "nameOcrRaw", "headerOcrRaw", "footerOcrRaw",
    ]
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in products:
            w.writerow(r)

    with WEAK_CSV.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "id", "placeholderName", "ocrFailedName", "sizeMm", "sizeFt", "finish",
                "pcsPerBox", "boxWeightKg", "pdfPage", "cataloguePage", "side",
                "textureUrl", "reason",
            ],
        )
        w.writeheader()
        for p in weak:
            w.writerow(
                {
                    "id": p["id"],
                    "placeholderName": p["name"],
                    "ocrFailedName": p.get("nameOcrFailed") or "",
                    "sizeMm": p.get("sizeMm"),
                    "sizeFt": p.get("sizeFt"),
                    "finish": p.get("finish"),
                    "pcsPerBox": p.get("pcsPerBox"),
                    "boxWeightKg": p.get("boxWeightKg"),
                    "pdfPage": p.get("pdfPage"),
                    "cataloguePage": p.get("cataloguePage"),
                    "side": p.get("side"),
                    "textureUrl": p.get("textureUrl"),
                    "reason": p.get("nameScoreReason") or "weak-ocr",
                }
            )

    # Apply high-confidence + placeholders into catalogue (safe names only)
    src = CATALOGUE.read_text(encoding="utf-8")
    applied = 0
    for p in products:
        name = p["name"].replace('"', "'")
        pid = p["id"]
        # name
        name_re = re.compile(rf'("id":\s*"{pid}",\s*\n\s*"name":\s*")([^"]*)(")')
        if name_re.search(src):
            src = name_re.sub(rf"\g<1>{name}\g<3>", src, count=1)
            applied += 1
        # size
        if p.get("sizeMm"):
            size_re = re.compile(
                rf'("id":\s*"{pid}"[\s\S]*?"size":\s*")([^"]*)(")',
            )
            src = size_re.sub(rf"\g<1>{p['sizeMm']}\g<3>", src, count=1)
        # finish
        if p.get("finish"):
            fin_re = re.compile(
                rf'("id":\s*"{pid}"[\s\S]*?"finish":\s*")([^"]*)(")',
            )
            src = fin_re.sub(rf"\g<1>{p['finish']}\g<3>", src, count=1)

    CATALOGUE.write_text(src, encoding="utf-8")

    # Calculator seed: all 140 with best available name
    calc = {
        "source": "scripts/floor-catalogue-structured.json",
        "updatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "count": len(products),
        "highConfidenceNames": len(kept),
        "placeholderNames": len(weak),
        "products": [
            {
                "id": p["id"],
                "name": p["name"],
                "code": p.get("code") or None,
                "sizeMm": p.get("sizeMm"),
                "sizeFt": p.get("sizeFt"),
                "finish": p.get("finish"),
                "pcsPerBox": int(p["pcsPerBox"]) if str(p.get("pcsPerBox") or "").isdigit() else p.get("pcsPerBox"),
                "boxWeightKg": float(p["boxWeightKg"]) if p.get("boxWeightKg") else None,
                "surface": "Floor",
                "confidence": p.get("confidence"),
                "textureUrl": p.get("textureUrl"),
            }
            for p in products
        ],
    }
    CALC.write_text(json.dumps(calc, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"High-confidence names: {len(kept)}")
    print(f"Placeholder slots filled: {len(weak)}")
    print(f"Catalogue name fields updated: {applied}")
    print(f"Weak remaining file: {WEAK_CSV}")
    print("\nHigh-confidence sample:")
    for p in kept[:15]:
        print(f"  {p['id']}: {p['name']} | {p['sizeMm']} | {p['finish']}")
    print("\nPlaceholder / still-weak slots:")
    for p in weak:
        print(
            f"  {p['id']}: {p['name']}  "
            f"(pdf p{p['pdfPage']} {p.get('side')}, size {p.get('sizeMm')}, "
            f"ocr was {p.get('nameOcrFailed')!r})"
        )


if __name__ == "__main__":
    main()
