# Weak-name review summary

**Date:** 2026-08-11  
**Script:** `python scripts/review_weak_names.py` → strict filter → restore from catalogue → `apply_*`

## Results after review

| Family | Products | High-confidence names | Placeholders / non-product | Notes |
|--------|----------:|----------------------:|---------------------------:|-------|
| Floor (GT) | 140 | **49** | 91 | Sizes solid; many pages still unreadable OCR |
| Wall (GT2025) | 292 | **223** | 69 | +HL design codes recovered (e.g. `56177-HL`) |
| Sunflora 2×4 | 36 | **34** | 0 product placeholders + **2 non-product** covers | Covers marked non-product |
| Sky 12×18 | 72 | **63** | 9 | +1 code (`2033-LT`); 9 decorative/special pages unreadable |
| Skype 2×4 | 16 | **16** | 0 | Already coded |

### Net change vs pre-review

| Family | Before high | After high | Δ |
|--------|------------:|-----------:|--:|
| Floor | 59 | 49 | −10* |
| Wall | 221 | 223 | +2 |
| Sunflora | 32 | 34 (+2 covers labeled non-product) | cleaner |
| Sky | 62 | 63 | +1 |
| Skype | 16 | 16 | 0 |

\*Floor high count **fell** because false-positive OCR garbage (series labels, adhesive copy, stutter text) was **stripped**. Remaining 49 are cleaner product names/codes. All **140** still have correct size packing for the calculator.

## What was fixed

### Sunflora
- `sunflora-c001` / `c002` → **Cover / Divider (not a product)** — excluded from sellable size calc logic.
- Product names unchanged (already strong dual-page handling).

### Sky 12×18
- Re-OCR of 10 weak slots → recovered **`2033-LT`** (`sky12x18-c047`).
- Remaining weak pages: decorative headers, “SPECIAL COLOUR” spreads, lifestyle-only layouts — no stable design code in the header band.

### Wall (Global 2025)
- Salvaged codes from weak CSV: `Lx-66`, `Lx-10`, `Vm-09`, `El-1015`, `El-1953`, `El-3011`, `Parken`, `Eevee`, `Fated`, …
- Re-OCR recovered **~22 `NNNNN-HL` style codes** that were previously collapsed to `Hl-1` placeholders.
- Strict filter removed OCR stutter / chrome words (`Dimension`, `Premium`, `Mrp`, etc.).

### Floor
- Re-OCR attempted on 82 weak slots; most stay weak (catalogue typography is hard).
- False “high” names removed: *Color Body Series*, *Glossy Glossy*, adhesive/mortar copy.
- Valid color+finish names kept when present: *Super White Matt*, *Galaxy Black Matt*, *Caramel Matt*, etc. (via catalogue restore).

## Remaining weak files (for manual spot-check)

| File | Rows |
|------|-----:|
| `scripts/floor-weak-slots-remaining.csv` | 91 |
| `scripts/gt2025-weak-slots-remaining.csv` | 69 |
| `scripts/sky12x18-weak-slots-remaining.csv` | 9 |
| `scripts/sunflora-weak-slots-remaining.csv` | 0 product weak |
| `scripts/skype-weak-slots-remaining.csv` | 0 |

## Size calculator seeds (all present)

- `src/data/floorSizeCalculator.json`
- `src/data/wallSizeCalculator.json`
- `src/data/sunfloraSizeCalculator.json`
- `src/data/sky12x18SizeCalculator.json`
- `src/data/skypeSizeCalculator.json`

## Re-run commands

```bash
python scripts/review_weak_names.py --family all
python scripts/_restore_names_from_catalogue.py
node scripts/apply_floor_catalogue.mjs
node scripts/apply_gt2025_catalogue.mjs
node scripts/apply_sunflora_catalogue.mjs
node scripts/apply_sky12x18_catalogue.mjs
node scripts/apply_skype_catalogue.mjs
```

## Manual next steps (optional)

1. **Sky ×9** — open PDF pages listed in weak CSV; type design codes by hand into `sky12x18-catalogue-structured.json`.
2. **Floor ×91** — prioritize high-margin series pages; many need human eye on the PDF.
3. **Wall ×69** — focus on chips still showing `Global Wall Tile #N` after HL recovery.

## Size glitch fix (done)

- **gt2025-c141..c144** (Briko-Carrot, Briko-Khakhi, Toners, Stony-22): OCR `73×300mm` → **`75×300mm` / 3"×12"** subway.
- Updated: structured JSON/CSV, `wallSizeCalculator.json`, `importedCatalogue.js`.
- `extract_gt2025_catalogue.py` hardened so 3"×12" pages no longer accept `73×300`.
