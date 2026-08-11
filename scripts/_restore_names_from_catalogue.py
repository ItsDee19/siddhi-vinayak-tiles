"""
Merge catalogue names back into structured JSON when structured name was
over-aggressively cleared, then re-score confidence.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "src/data/importedCatalogue.js"

src = CAT.read_text(encoding="utf-8")
cat = dict(re.findall(r'"id":\s*"([^"]+)",\s*\n\s*"name":\s*"([^"]+)"', src))

PLACEHOLDER = re.compile(
    r"^(Global (Floor|Wall) Tile #|Sunflora 2X4 Tile #|Sky 12x18 Concept #|Skype Tile #)",
    re.I,
)
STUTTER = re.compile(r"(.)\1{3,}")
JUNK_ONE = re.compile(
    r"^(Black|Single|Plain|Lets|Anal|Otrr|Pene|Carer|Babee|Dimension|Premium|"
    r"Pull-Out|Mrp|User|Suspect|Glossy|Matte|With|Tee|Eee|Cal|Gas|Wee|Raga|"
    r"Lene|Faia|Aia|Jeep|Cld|Ona|Deg|Yoy|Emer|Tels|Ated|Meno|Whol|Ail|Woe|"
    r"Vac|Pel|Git|Nurs|Aria|Ant|Pars|Apes|Coan|Cael|Baad|Wen|Uzay|Cima|"
    r"Ener|Myer|Anil|Ants|Seay|Seal|Pall|Nan|Meee|Lal|Toth|Meme|Sori|"
    r"Belteart|Eeoeoe|Soaaumens|Oiierranss|Satnnansereey|180MM)$",
    re.I,
)


def good_name(name: str, family: str) -> bool:
    if not name or PLACEHOLDER.match(name):
        return False
    if STUTTER.search(name) or JUNK_ONE.match(name):
        return False
    if family == "wall":
        # HL codes, product codes, multi-word
        if re.match(r"^\d{3,5}-HL$", name, re.I):
            return True
        if re.match(r"^[A-Za-z]{1,4}-?\d{2,5}(?:-?[A-Za-z0-9]{1,4}){0,2}$", name):
            return True
        if re.match(r"^[A-Za-z][A-Za-z0-9]+(?:[-/ ][A-Za-z0-9]+){0,4}(?:\s*\([^)]+\))?$", name):
            letters = sum(c.isalpha() for c in name)
            return letters >= 4 and len(name) <= 48
        return False
    if family == "floor":
        if re.search(r"series|adhesive|mortar|baker board|coverage", name, re.I):
            return False
        if re.match(r"^[A-Z]-?\d{4,6}$", name):
            return True
        # Color + finish e.g. Super White Matt
        if re.search(r"\b(Matt|Matte|Glossy|Carving|Polished)\b", name, re.I):
            letters = sum(c.isalpha() for c in name)
            return letters >= 8
        letters = sum(c.isalpha() for c in name)
        if letters < 5:
            return False
        if re.search(r"[^A-Za-z0-9 \-()'/&.]", name):
            return False
        return True
    return bool(name)


FAMILIES = [
    ("scripts/gt2025-catalogue-structured.json", "wall", re.compile(r"^gt2025-c")),
    ("scripts/floor-catalogue-structured.json", "floor", re.compile(r"^gt-floor-c")),
    ("scripts/sky12x18-catalogue-structured.json", "sky", re.compile(r"^sky12x18-c")),
    ("scripts/sunflora-catalogue-structured.json", "sunflora", re.compile(r"^sunflora-c")),
]


def main():
    for rel, family, id_re in FAMILIES:
        path = ROOT / rel
        data = json.loads(path.read_text(encoding="utf-8"))
        restored = kept = 0
        for p in data["products"]:
            if p.get("confidence") == "non_product":
                continue
            pid = p["id"]
            cur = (p.get("name") or "").strip()
            cat_name = (cat.get(pid) or "").strip()

            if good_name(cur, family):
                p["confidence"] = "high"
                kept += 1
                continue

            if good_name(cat_name, family):
                p["name"] = cat_name
                p["confidence"] = "high"
                restored += 1
                continue

            # keep size/finish; clear bad name
            if not good_name(cur, family):
                p["name"] = ""
                p["confidence"] = "placeholder"

        data["named"] = sum(1 for p in data["products"] if p.get("name"))
        data["highConfidence"] = sum(
            1 for p in data["products"] if p.get("confidence") == "high"
        )
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(
            f"[{family}] high={data['highConfidence']} restored_from_catalogue={restored} kept_structured={kept}"
        )


if __name__ == "__main__":
    main()
