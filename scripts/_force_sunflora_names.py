"""Force-apply sunflora names/sizes from structured extract into catalogue."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/data/importedCatalogue.js"
EXTRACT = ROOT / "scripts/sunflora-catalogue-structured.json"


def is_good(name: str) -> bool:
    if not name or len(name) < 4:
        return False
    if re.match(r"^Sunflora\s+\d", name, re.I):
        return False
    if " / " in name:
        return all(is_good(p.strip()) for p in name.split(" / "))
    if re.match(r"^3D[-\s]?\d+", name, re.I):
        return True
    letters = sum(c.isalpha() for c in name)
    if letters < 5:
        return False
    if re.match(
        r"^(Cv|Sp|End|3D|Subway|Sense|Prestige|Monostone|Fort|Mozo|Diamond|Endless)\b",
        name,
        re.I,
    ):
        return True
    return letters >= 8


def main():
    products = json.loads(EXTRACT.read_text(encoding="utf-8"))["products"]
    src = DATA.read_text(encoding="utf-8")
    n_name = n_size = n_fin = 0

    for p in products:
        pid = p["id"]
        name = (p.get("name") or "").strip()
        if not is_good(name):
            continue
        size = p.get("sizeMm") or "600×1200mm"
        finish = p.get("finish") or "Carving"

        def sub_name(m):
            nonlocal n_name
            n_name += 1
            return f'{m.group(1)}{name.replace(chr(34), chr(39))}{m.group(3)}'

        src2, c = re.subn(
            rf'("id":\s*"{re.escape(pid)}",\s*\n\s*"name":\s*")([^"]*)(")',
            sub_name,
            src,
            count=1,
        )
        if c:
            src = src2

        def sub_size(m):
            nonlocal n_size
            n_size += 1
            return f"{m.group(1)}{size}{m.group(3)}"

        src2, c = re.subn(
            rf'("id":\s*"{re.escape(pid)}"[\s\S]*?"size":\s*")([^"]*)(")',
            sub_size,
            src,
            count=1,
        )
        if c:
            src = src2

        def sub_fin(m):
            nonlocal n_fin
            n_fin += 1
            return f"{m.group(1)}{finish}{m.group(3)}"

        src2, c = re.subn(
            rf'("id":\s*"{re.escape(pid)}"[\s\S]*?"finish":\s*")([^"]*)(")',
            sub_fin,
            src,
            count=1,
        )
        if c:
            src = src2

    DATA.write_text(src, encoding="utf-8")
    print(f"names={n_name} sizes={n_size} finishes={n_fin}")

    # verify a few
    pairs = re.findall(r'"id":\s*"(sunflora-c\d+)",\s*\n\s*"name":\s*"([^"]+)"', src)
    for a, b in pairs:
        if a in {"sunflora-c018", "sunflora-c020", "sunflora-c023", "sunflora-c004"}:
            print(f"  {a}: {b}")


if __name__ == "__main__":
    main()
