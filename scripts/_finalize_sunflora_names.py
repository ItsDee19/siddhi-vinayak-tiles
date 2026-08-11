"""Final name cleanup for sunflora structured extract."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "scripts" / "sunflora-catalogue-structured.json"
CSV_OUT = ROOT / "scripts" / "sunflora-catalogue-structured.csv"

# Authoritative cleanups after OCR + review merge
FIXES = {
    "sunflora-c001": ("", "low"),  # cover
    "sunflora-c002": ("", "low"),  # divider
    "sunflora-c014": ("Sp Subway White Decor", "high"),
    "sunflora-c019": ("Sense Pearl Decor / Sense Pearl", "high"),
    "sunflora-c022": ("Prestige Crackle Decor / Prestige Crackle", "high"),
    "sunflora-c023": ("Mozo Midas Decor", "high"),
    "sunflora-c024": ("Monostone Crema Decor", "high"),
    "sunflora-c025": ("Monostone Brown Decor", "high"),
    "sunflora-c026": ("Fort Crema Decor / Fort Crema", "high"),
    "sunflora-c027": ("Fort Brown Decor / Fort Brown", "high"),
    "sunflora-c028": ("Endless Collection", "medium"),
    "sunflora-c035": ("Diamond Onyx Decor", "high"),
    "sunflora-c036": ("3D-1001", "medium"),
}


def is_garbage(name: str) -> bool:
    if not name:
        return True
    if re.search(r"(.)\1{3,}", name):
        return True
    toks = name.replace("/", " ").split()
    if len(toks) <= 2 and all(len(t) <= 3 for t in toks):
        return True
    if sum(1 for t in toks if len(t) <= 2) >= 2 and len(toks) <= 4:
        return True
    if re.search(r"Scsss|Feo Ss|Pone|Parvials|Enone|Eosin|Ee S|Wo Pw", name, re.I):
        return True
    return False


def main():
    data = json.loads(EXTRACT.read_text(encoding="utf-8"))
    for p in data["products"]:
        pid = p["id"]
        if pid in FIXES:
            name, conf = FIXES[pid]
            p["name"] = name
            p["confidence"] = conf
            if not name:
                p["layout"] = "empty"
            continue
        name = p.get("name") or ""
        name = re.sub(r"^END\b", "End", name)
        name = re.sub(r"^SP\b", "Sp", name)
        name = re.sub(r"^CV\b", "Cv", name)
        name = re.sub(r"\s+", " ", name).strip()
        # drop trailing OCR junk after dual
        if " / " in name:
            left, right = [x.strip() for x in name.split(" / ", 1)]
            if is_garbage(right) or len(right) < 4:
                name = left
        if is_garbage(name):
            p["name"] = ""
            p["confidence"] = "low"
        else:
            p["name"] = name
            if p.get("confidence") not in ("high", "medium"):
                p["confidence"] = "medium"

        p.setdefault("sizeMm", "600×1200mm")
        p.setdefault("sizeFt", "2×4 Ft")
        p.setdefault("finish", "Carving")

    data["named"] = sum(1 for p in data["products"] if p.get("name"))
    data["highConfidence"] = sum(1 for p in data["products"] if p.get("confidence") == "high")
    EXTRACT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    fields = [
        "id",
        "name",
        "altNames",
        "sizeMm",
        "sizeFt",
        "finish",
        "thicknessMm",
        "surface",
        "pdfPage",
        "slot",
        "layout",
        "textureFile",
        "textureUrl",
        "confidence",
        "nameOcrRaw",
        "specsOcrRaw",
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for p in data["products"]:
            w.writerow(p)

    print(f"named={data['named']} high={data['highConfidence']}")
    for p in data["products"]:
        print(f"{p['id']}: {p['name'] or '—'} [{p['confidence']}]")


if __name__ == "__main__":
    main()
