"""Pull ARCH-WHITE etc. from nameOcrRaw; drop junk codes."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "scripts/sky12x18-catalogue-structured.json"

ARCH = re.compile(r"\bARCH[-\s]?WHITE\b", re.I)
CODE = re.compile(
    r"\b((?:ARCH[-\s]?WHITE)|(?:WOOD[-\s]?\d+[-\s]?[A-Z]{0,3})|(?:\d{2,5}[-\s]?[A-Z]{1,6}))\b",
    re.I,
)
JUNK = {"74-HIME", "74HIME", "HIME", "4002-I"}


def main():
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    fixed = 0
    for p in data["products"]:
        raw = p.get("nameOcrRaw") or ""
        name = (p.get("name") or "").upper().replace(" ", "-")
        if name in JUNK or name.startswith("74-"):
            name = ""
        if not name and ARCH.search(raw):
            name = "ARCH-WHITE"
        if not name:
            for m in CODE.finditer(raw.upper()):
                cand = m.group(1).replace(" ", "-")
                if cand in JUNK or cand.startswith("74-"):
                    continue
                if cand in {"450X300"}:
                    continue
                name = cand
                break
        if name:
            p["name"] = name
            p["confidence"] = "high"
            fixed += 1
        else:
            p["name"] = ""
            p["confidence"] = "low"
    data["named"] = sum(1 for p in data["products"] if p.get("name"))
    data["highConfidence"] = sum(1 for p in data["products"] if p.get("confidence") == "high")
    EXTRACT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"named={data['named']} high={data['highConfidence']} touched={fixed}")
    for p in data["products"]:
        if p.get("confidence") != "high":
            print(" weak", p["id"], repr(p.get("nameOcrRaw", "")[:60]))


if __name__ == "__main__":
    main()
