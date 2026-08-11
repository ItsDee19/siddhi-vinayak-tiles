"""Strict quality filter after weak-name review — drop OCR garbage, keep real codes/names."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WALL_JUNK = re.compile(
    r"^(Black|Single|Plain|Lets|Anal|Otrr|Pene|Carer|Babee|Belteart|Eeoeoe|"
    r"Soaaumens|Oiierranss|Satnnansereey|Bruuud|Dimension|Premium|Pull-Out|"
    r"Mrp|User|Suspect|Glossy|Matte|180MM|Al Nn Ae)$",
    re.I,
)
FLOOR_JUNK = re.compile(
    r"glossy|matte|matt|series|color body|fullbody|adherive|adhesive|"
    r"cement|mortar|modified|flexible|baker board|coverage|weight|"
    r"^global floor",
    re.I,
)
WALL_CODE_OK = re.compile(r"^[A-Za-z]{1,4}-?\d{2,5}(?:-?[A-Za-z]{1,3})?$")
WALL_HL = re.compile(r"^\d{3,5}-HL$", re.I)
# very short letter-digit like W-2 / A-7 are usually OCR noise
WALL_SHORT_JUNK = re.compile(r"^[A-Za-z]-\d$", re.I)
FLOOR_CODE = re.compile(r"^[A-Z]-?\d{4,6}$", re.I)


def stutter(s: str) -> bool:
    return bool(re.search(r"(.)\1{3,}", s))


def good_wall(name: str) -> bool:
    if not name or len(name) < 3 or len(name) > 36:
        return False
    if WALL_JUNK.match(name) or stutter(name):
        return False
    if re.search(r"[^A-Za-z0-9 \-/]", name):
        return False
    if WALL_SHORT_JUNK.match(name):
        return False
    if WALL_HL.match(name) or WALL_CODE_OK.match(name.replace(" ", "")):
        return True
    letters = sum(c.isalpha() for c in name)
    # Real word names: Parken, Eevee, Fated, Elian
    if letters >= 5 and " " not in name and not re.search(r"\d", name):
        return True
    if letters >= 6 and name.count(" ") <= 2:
        return True
    return False


def good_floor(name: str) -> bool:
    if not name or len(name) < 3 or len(name) > 40:
        return False
    if FLOOR_JUNK.search(name) or stutter(name):
        return False
    if re.search(r"[^A-Za-z0-9 \-()'/&.]", name):
        return False
    if FLOOR_CODE.match(name.replace(" ", "")):
        return True
    letters = sum(c.isalpha() for c in name)
    toks = name.split()
    # reject single short token without code shape
    if len(toks) == 1 and letters < 5 and not re.search(r"\d", name):
        return False
    # reject names that are mostly punctuation/fragments
    if letters < 5:
        return False
    short = sum(1 for t in toks if len(t) <= 1)
    if short >= 2:
        return False
    return True


def good_sky(name: str) -> bool:
    if not name:
        return False
    n = name.upper().replace(" ", "-")
    if n in {"74-HIME", "HIME", "4002-I"} or n.startswith("74-"):
        return False
    return bool(
        re.match(
            r"^(ARCH-?WHITE|WOOD-\d+-?[A-Z]{0,3}|\d{2,5}-?[A-Z]{1,6})$",
            n,
        )
    )


def filter_family(path: Path, family: str) -> tuple[int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    kept = dropped = 0
    for p in data["products"]:
        name = (p.get("name") or "").strip()
        conf = p.get("confidence") or ""
        if conf == "non_product":
            continue
        ok = False
        if family == "wall":
            ok = good_wall(name)
        elif family == "floor":
            ok = good_floor(name)
        elif family == "sky":
            ok = good_sky(name)
        elif family == "sunflora":
            ok = bool(name) and not re.match(r"^Sunflora", name, re.I) and len(name) >= 4
        if ok:
            p["confidence"] = "high"
            kept += 1
        else:
            if name and conf == "high":
                dropped += 1
                print(f"  drop {family} {p['id']}: {name!r}")
            p["name"] = "" if family != "sunflora" else ("" if conf == "non_product" else name if ok else "")
            if family == "sunflora" and conf == "non_product":
                pass
            else:
                p["confidence"] = "placeholder"
                if not ok:
                    p["name"] = ""
    data["named"] = sum(1 for p in data["products"] if p.get("name"))
    data["highConfidence"] = sum(1 for p in data["products"] if p.get("confidence") == "high")
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return kept, dropped


def main():
    pairs = [
        (ROOT / "scripts/gt2025-catalogue-structured.json", "wall"),
        (ROOT / "scripts/floor-catalogue-structured.json", "floor"),
        (ROOT / "scripts/sky12x18-catalogue-structured.json", "sky"),
        (ROOT / "scripts/sunflora-catalogue-structured.json", "sunflora"),
    ]
    for path, fam in pairs:
        if not path.exists():
            print("missing", path)
            continue
        kept, dropped = filter_family(path, fam)
        data = json.loads(path.read_text(encoding="utf-8"))
        print(f"[{fam}] high={data.get('highConfidence')} named={data.get('named')} dropped={dropped}")


if __name__ == "__main__":
    main()
