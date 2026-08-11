"""Merge review CSV + manual dual-page names into sunflora structured extract."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "scripts" / "sunflora-catalogue-structured.json"
CSV_OUT = ROOT / "scripts" / "sunflora-catalogue-structured.csv"

NOTE_RE = re.compile(r"\(([^)]+)\)")

MANUAL = {
    "sunflora-c004": "Cv Silestone White / Cv Silestone Nero",
    "sunflora-c011": "Sp Iconic Beige Decor / Sp Iconic Beige Frame",
    "sunflora-c018": "Subway Carara Decor / Subway Carara",
    "sunflora-c020": "Sense Flora Decor / Sense Flora",
    "sunflora-c033": "End Antheni Mint / End Antheni Pink",
    "sunflora-c034": "End Antheni Grey / End Antheni Nero",
}


def parse_csv(path: Path):
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def title(s: str) -> str:
    parts = []
    for w in s.split():
        if re.search(r"\d", w):
            parts.append(w.upper())
        elif w.upper() in {"CV", "SP", "END", "3D", "POS"}:
            parts.append(w[:1].upper() + w[1:].lower())
        else:
            parts.append(w[:1].upper() + w[1:].lower())
    return " ".join(parts)


def dedupe_name(n: str) -> str:
    if not n:
        return n
    n = re.sub(r"\s+", " ", n).strip(" .-")
    m = re.match(r"^(.+?)\s+\1(.*)$", n, re.I)
    if m:
        n = (m.group(1) + " " + m.group(2)).strip()
    n = re.sub(r"\s+(Ptoorms|Aenane|A Ee|Seco)\b.*", "", n, flags=re.I)
    return n.strip(" .-")


def is_good(n: str) -> bool:
    if not n or len(n) < 4:
        return False
    if re.match(r"^Sunflora", n, re.I):
        return False
    letters = sum(c.isalpha() for c in n)
    if letters < 4:
        return False
    toks = n.replace("/", " ").split()
    short = sum(1 for t in toks if len(t) <= 1)
    if short >= 2:
        return False
    if re.search(r"[^A-Za-z0-9 \-/&'.]", n):
        return False
    # reject OCR garble with too many tiny words
    if len(toks) >= 4 and sum(1 for t in toks if len(t) <= 2) >= 3:
        return False
    return True


def main():
    extract = json.loads(EXTRACT.read_text(encoding="utf-8"))

    review_names: dict[str, str] = {}
    empty_ids: set[str] = set()
    for rel in (
        "scripts/tile-names-review-sunflora-new.csv",
        "scripts/tile-names-review-sunflora.csv",
    ):
        for row in parse_csv(ROOT / rel):
            pid = row.get("id", "")
            sug = (row.get("suggested_name") or "").strip()
            accept = str(row.get("ACCEPT", "")).lower() == "yes"
            conf = float(row.get("confidence") or row.get("quality") or 0)
            note = (row.get("note") or "").strip()
            if sug and (accept or conf >= 70):
                review_names.setdefault(pid, title(sug))
            if pid not in review_names and note:
                m = NOTE_RE.search(note)
                if m and "/" in m.group(1):
                    review_names[pid] = title(m.group(1))
                elif re.search(r"cover|divider", note, re.I):
                    empty_ids.add(pid)

    for p in extract["products"]:
        pid = p["id"]
        name = dedupe_name(p.get("name") or "")

        if pid in MANUAL:
            name = MANUAL[pid]
            p["confidence"] = "high"
        elif pid in review_names:
            name = review_names[pid]
            p["confidence"] = "high"
        elif pid in empty_ids:
            name = ""
            p["confidence"] = "low"
            p["layout"] = "empty"
        elif not is_good(name):
            alts = (p.get("altNames") or "").split("|")
            found = ""
            for a in alts:
                a = dedupe_name(a.strip())
                if is_good(a):
                    found = a
                    break
            name = found
            p["confidence"] = "high" if found else "low"
        else:
            if re.match(
                r"^(Cv|Sp|End|Subway|Sense|3D|Monostone|Prestige|Fort|Mozo|Diamond|Endless)",
                name,
                re.I,
            ):
                p["confidence"] = "high"
            elif p.get("confidence") == "low":
                p["confidence"] = "medium"

        p["name"] = name
        if not p.get("sizeMm"):
            p["sizeMm"] = "600×1200mm"
        if not p.get("sizeFt"):
            p["sizeFt"] = "2×4 Ft"
        if not p.get("finish"):
            p["finish"] = "Carving"

    extract["named"] = sum(1 for p in extract["products"] if p.get("name"))
    extract["highConfidence"] = sum(
        1 for p in extract["products"] if p.get("confidence") == "high"
    )
    EXTRACT.write_text(json.dumps(extract, indent=2, ensure_ascii=False), encoding="utf-8")

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
        for p in extract["products"]:
            w.writerow(p)

    print(f"named {extract['named']} high {extract['highConfidence']}")
    for p in extract["products"]:
        print(f"{p['id']}: {p['name'] or '—'} [{p['confidence']}]")


if __name__ == "__main__":
    main()
