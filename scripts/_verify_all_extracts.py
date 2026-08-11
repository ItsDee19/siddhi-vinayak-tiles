import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for f in [
    "floorSizeCalculator.json",
    "wallSizeCalculator.json",
    "sunfloraSizeCalculator.json",
    "sky12x18SizeCalculator.json",
    "skypeSizeCalculator.json",
]:
    p = ROOT / "src/data" / f
    if not p.exists():
        print(f, "MISSING")
        continue
    d = json.loads(p.read_text(encoding="utf-8"))
    print(
        f"{f}: {d.get('count')} products | high={d.get('highConfidenceNames')} | "
        f"placeholders={d.get('placeholderNames')} | sizes={d.get('sizeHistogram')}"
    )

src = (ROOT / "src/data/importedCatalogue.js").read_text(encoding="utf-8")
for fam in ["sunflora-c", "sky12x18-c", "skype-c"]:
    pairs = re.findall(
        rf'"id":\s*"({fam}\d+)",\s*\n\s*"name":\s*"([^"]+)"',
        src,
    )
    print(f"{fam}: {len(pairs)} in catalogue; sample {pairs[:3]}")
