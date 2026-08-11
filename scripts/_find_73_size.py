import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

d = json.loads((ROOT / "scripts/gt2025-catalogue-structured.json").read_text(encoding="utf-8"))
bad = [p for p in d["products"] if "73" in (p.get("sizeMm") or "")]
print("structured bad", len(bad))
for p in bad:
    print(
        p["id"],
        p.get("name"),
        p.get("sizeMm"),
        p.get("sizeIn"),
        "page",
        p.get("pdfPage"),
        "var",
        p.get("variant"),
        "header",
        (p.get("headerOcrRaw") or "")[:100],
        "footer",
        (p.get("footerOcrRaw") or "")[:100],
    )

c = json.loads((ROOT / "src/data/wallSizeCalculator.json").read_text(encoding="utf-8"))
bad2 = [p for p in c["products"] if "73" in (p.get("sizeMm") or "")]
print("calc bad", [p["id"] for p in bad2])

src = (ROOT / "src/data/importedCatalogue.js").read_text(encoding="utf-8")
for m in re.finditer(
    r'"id":\s*"(gt2025-c\d+)"[\s\S]{0,250}?"size":\s*"([^"]+)"',
    src,
):
    if "73" in m.group(2):
        print("cat", m.group(1), m.group(2))
