"""
Re-extraction pipeline for tile swatch photos, built to fix the "white lines /
diagonal lines" defect seen when swatches are tiled in the 3D visualizer.

Root cause (confirmed by direct inspection of gt-floor-c001-swatch.webp): the
original extractor (scripts/extract_clean_tiles.py) uses ONE fixed fractional
crop box per family, applied identically to every page. Page layouts vary
enough that the fixed box sometimes grabs blank margin alongside the real tile
photo. That margin survives into the derived visualizer texture, and when
RepeatWrapping tiles it, the margin repeats as a visible light band -- a
straight line if the margin is on one edge, a cross if on two.

Fix, per page:
  1. Render at high DPI (this script) -- much sharper than the ~150dpi many
     pages were originally captured at.
  2. Detect real PHOTO regions via edge-density contours (reused from
     detect_tile_regions.py's detect_photo_regions) rather than trusting a
     fixed box -- this adapts per page instead of assuming one layout.
  3. Autocrop any residual near-uniform border still inside that detected
     box, driven by per-row/col luminance variance (same principle as
     build_visualizer_tiles.mjs's frame trim, applied here before the JS
     seamless/POT pass so it starts from genuinely tile-only pixels).
  4. Save at native detected resolution (no upscale at this stage).

Output goes to a NEW, parallel directory -- the live clean_swatches/ tree
used by the bottom product grid AND the current visualizer texture path is
left untouched until the result is inspected and approved.

Usage:
    python scripts/extract_tile_swatch_v2.py --family gt-floor [--limit 20] [--start 3]
"""

import argparse
import os

import cv2
import fitz
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public/assets/catalogue/clean_swatches_v2")
QA_DIR = os.path.join(ROOT, ".tile-qa")
DPI = 400
SCALE = DPI / 72

FAMILIES = {
    "gt-floor": {
        "pdf": r"C:\Users\KIIT\Downloads\GLOBAL TILES FLOOR CATALOGUE.pdf",
        "start_page": 2,  # 0-indexed; matches extract_pdf1's range(2, len(doc))
        "id_start": 1,
        "id_prefix": "gt-floor-c",
        # search bounds per slot, as (x_lo, x_hi, y_lo, y_hi) fractions of
        # the full two-page spread -- "left"/"right" halves here
        "slots": [(0.0, 0.5, 0.0, 1.0), (0.5, 1.0, 0.0, 1.0)],
    },
    "gt2025": {
        "pdf": r"C:\Users\KIIT\Downloads\GLOBAL TILES 2025 CATALOGUE.pdf",
        "start_page": 2,  # 0-indexed; matches extract_pdf2's range(2, min(75, len(doc)))
        "end_page": 75,
        "id_start": 141,  # matches extract_pdf2's card_index start
        "id_prefix": "gt2025-c",
        # 4 quadrants per page (top-left, bottom-left, top-right,
        # bottom-right), generously padded around the original extractor's
        # fixed boxes so the real swatch is found even when it drifts
        "slots": [
            (0.0, 0.35, 0.0, 0.38),
            (0.0, 0.35, 0.38, 0.80),
            (0.45, 0.85, 0.0, 0.38),
            (0.45, 0.85, 0.38, 0.80),
        ],
        # quadrant swatches run bigger (~17.5% of page) and a bit squarer
        # (~1.65) than gt-floor's 1:2 plank crops
        "expect_aspects": (1.25, 1.5, 1.65, 1.8, 2.0),
        "size_range": (0.08, 0.25),
        # the real color-chip label is baked into the top-left corner of
        # the big install photo, not a separately detectable region -- pull
        # just that corner sub-rect (fraction within the detected region)
        # rather than the whole busy photo (mirrors/fixtures/reflections
        # would otherwise repeat as visible artifacts when tiled)
        "chip_subrect": (0.0, 0.0, 0.38, 0.155),
    },
}


def page_to_cv(page):
    mat = fitz.Matrix(SCALE, SCALE)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def detect_photo_regions(img):
    """Find rectangular photo-like regions anywhere on the page.

    Contour boxes come from Canny edges (an image's own border against the
    white page is a strong edge even when the texture inside is subtle, so
    this still finds the right box shapes). The accept test here is
    deliberately loose: a genuinely plain/minimally-veined stone can measure
    LOWER blurred-luminance std than blank page background (measured on a
    real product: 2.4, vs ~6.5-9.7 for blank paper) so variance cannot
    reliably separate "plain tile" from "blank" -- only "some structure
    exists at all" from "perfectly flat rectangle" (a bare logo swatch of
    color with no text/graphic). The real discrimination between a genuine
    swatch and a wrong candidate (logo card, hero photo, room interior)
    happens downstream in find_best_swatch_region's aspect/size/position
    scoring, not here."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 30, 110)
    dilated = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    h, w = img.shape[:2]
    boxes = []
    for c in contours:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw < w * 0.10 or bh < h * 0.06:
            continue
        # tall single-piece slab panels run up to 800x3000mm (aspect ~0.27,
        # h_frac up to ~0.64) -- give real headroom above that rather than
        # clipping right at the boundary
        if bw > w * 0.55 or bh > h * 0.70:
            continue
        aspect = bw / float(bh or 1)
        # the catalogue also carries tall single-piece slabs printed
        # portrait: 800x2400mm (aspect ~0.33) up to 800x3000mm (~0.27) --
        # which the old 0.5 floor silently discarded before scoring ever ran
        if not (0.20 <= aspect <= 4.5):
            continue
        region = gray[y : y + bh, x : x + bw]
        score = cv2.GaussianBlur(region, (31, 31), 0).std()
        if score < 1.5:
            continue
        boxes.append((x, y, bw, bh, score))

    # Dedup largest-first, not highest-variance-first: a small high-contrast
    # fragment inside a real swatch (the boldest vein cluster in a marble
    # photo, say) can score higher on blurred_std than the whole box
    # averaged out. Sorting by score let that fragment win the slot and then
    # discard the full, correct swatch box as "overlapping" with it -- this
    # was silently dropping legitimate matches (confirmed: a page's entire
    # swatch region vanished from the candidate list this way even though
    # raw contour detection had found it cleanly). Area-first keeps the
    # complete region and folds sub-fragments into it instead.
    boxes.sort(key=lambda b: -(b[2] * b[3]))
    kept = []
    for b in boxes:
        x, y, bw, bh, _ = b
        overlap = False
        for kx, ky, kw, kh, _ in kept:
            ix0, iy0 = max(x, kx), max(y, ky)
            ix1, iy1 = min(x + bw, kx + kw), min(y + bh, ky + kh)
            iw, ih = max(0, ix1 - ix0), max(0, iy1 - iy0)
            if iw * ih > 0.6 * min(bw * bh, kw * kh):
                overlap = True
                break
        if not overlap:
            kept.append(b)
    return [(x, y, bw, bh) for x, y, bw, bh, _ in kept]


def find_best_swatch_region(
    regions, page_w, page_h, bounds, expect_aspects=(0.27, 0.33, 1.0, 2.0), size_range=(0.03, 0.16)
):
    """Score candidate regions instead of just taking whichever is nearest a
    guess point -- "nearest" happily grabs a lifestyle photo, a ceiling, or
    even a logo when the true swatch position varies page to page or is
    simply absent (cover/divider pages). bounds = (x_lo, x_hi, y_lo, y_hi)
    as fractions of the page, generously padded around where the family's
    original fixed-box extractor aimed -- a real swatch thumbnail is roughly
    as wide as it is tall in the tile's own real-world proportions, but the
    catalogue mixes product lines within itself (600x1200mm planks at 1:2
    alongside 600x600mm squares at 1:1, sometimes on the same spread), so a
    single hardcoded target aspect wrongly rejects real square-tile matches.
    Score against whichever nominal aspect fits best. Modestly sized (not a
    full-bleed hero shot). Returns None -- skip this slot -- rather than
    force a bad match when nothing scores reasonably."""
    x_lo, x_hi, y_lo, y_hi = (bounds[0] * page_w, bounds[1] * page_w, bounds[2] * page_h, bounds[3] * page_h)

    candidates = [
        r for r in regions if x_lo <= r[0] + r[2] / 2 <= x_hi and y_lo <= r[1] + r[3] / 2 <= y_hi
    ]
    if not candidates:
        return None

    best, best_score = None, -1e9
    for x, y, bw, bh in candidates:
        area_frac = (bw * bh) / (page_w * page_h)
        aspect = bw / float(bh or 1)

        # aspect is the strongest signal here: the catalogue prints its own
        # nominal tile proportions on every page (e.g. "600x1200mm"), and a
        # wrong candidate pulled from inside a room photo (a wall panel, a
        # mirror, a sink) rarely lands anywhere near it -- weighted hard.
        aspect_penalty = min(abs(aspect - a) for a in expect_aspects) * 8.0
        size_lo, size_hi = size_range
        size_penalty = 0.0 if size_lo <= area_frac <= size_hi else abs(area_frac - (size_lo + size_hi) / 2) * 20

        score = -(aspect_penalty + size_penalty)
        if score > best_score:
            best_score, best = score, (x, y, bw, bh)

    # a score this low means nothing in this slot looked like a real swatch
    # (e.g. a full-bleed lifestyle photo with no separate thumbnail at all)
    # -- skip the slot rather than force a bad crop.
    if best_score < -3:
        return None
    return best


def autocrop_border(bgr):
    """Trim any residual near-uniform margin from each edge. A margin row/col
    has low internal variance AND its mean differs noticeably from the
    image's core -- same two-part test used for the clean_swatches source
    audit (avoids false-triggering on a genuinely flat/plain tile face,
    which has low variance EVERYWHERE including the core)."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float64)
    h, w = gray.shape
    if h < 20 or w < 20:
        return bgr

    core = gray[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    core_mean = core.mean()

    def row_ok(y):
        row = gray[y, :: max(1, w // 128)]
        return not (row.std() < 8 and abs(row.mean() - core_mean) > 26)

    def col_ok(x):
        col = gray[:: max(1, h // 128), x]
        return not (col.std() < 8 and abs(col.mean() - core_mean) > 26)

    top, bottom, left, right = 0, 0, 0, 0
    max_trim_v = int(h * 0.25)
    max_trim_h = int(w * 0.25)
    while top < max_trim_v and not row_ok(top):
        top += 1
    while bottom < max_trim_v and not row_ok(h - 1 - bottom):
        bottom += 1
    while left < max_trim_h and not col_ok(left):
        left += 1
    while right < max_trim_h and not col_ok(w - 1 - right):
        right += 1

    if top + bottom >= h - 10 or left + right >= w - 10:
        return bgr  # safety: don't crop into nothing on a false trigger
    return bgr[top : h - bottom, left : w - right]


def patch_mean_std(bgr, grid=4):
    """How much local-patch brightness varies across the crop. A real tile
    face -- even a busy marble -- is one material under even studio light,
    so large patches stay close in overall brightness. A wrongly-selected
    fragment of a room photo (crossing a mirror, a sink, a wall/floor
    transition, furniture) swings much more between patches. Used only to
    flag outliers for manual review, not as a hard reject -- the signal is
    real but not airtight (measured good: 1.2-14.6, measured bad: 16-19)."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ph, pw = max(1, h // grid), max(1, w // grid)
    means = []
    for i in range(grid):
        for j in range(grid):
            patch = gray[i * ph : (i + 1) * ph, j * pw : (j + 1) * pw]
            if patch.size:
                means.append(patch.mean())
    return float(np.std(means)) if means else 0.0


def save(bgr, path):
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, "WEBP", quality=95, method=6)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--family", required=True, choices=list(FAMILIES))
    ap.add_argument("--limit", type=int, default=None, help="max pages to process")
    ap.add_argument("--start", type=int, default=None, help="override start page (0-indexed)")
    ap.add_argument("--out-dir", type=str, default=None, help="override output directory (for staged re-runs)")
    args = ap.parse_args()

    cfg = FAMILIES[args.family]
    out_dir = args.out_dir or OUT_DIR
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(QA_DIR, exist_ok=True)

    doc = fitz.open(cfg["pdf"])
    start = args.start if args.start is not None else cfg["start_page"]
    end = min(len(doc), cfg.get("end_page", len(doc)))
    if args.limit:
        end = min(end, start + args.limit)

    counter = cfg.get("id_start", 1)
    written = 0
    fallback = 0
    flagged = []

    for page_idx in range(start, end):
        page = doc[page_idx]
        img = page_to_cv(page)
        h, w = img.shape[:2]
        regions = detect_photo_regions(img)

        for bounds in cfg["slots"]:
            fa_kwargs = {}
            if "expect_aspects" in cfg:
                fa_kwargs["expect_aspects"] = cfg["expect_aspects"]
            if "size_range" in cfg:
                fa_kwargs["size_range"] = cfg["size_range"]
            region = find_best_swatch_region(regions, w, h, bounds, **fa_kwargs)
            cid = f"{cfg['id_prefix']}{counter:03d}"
            counter += 1

            if region is None:
                fallback += 1
                continue

            x, y, bw, bh = region
            if "chip_subrect" in cfg:
                sx0, sy0, sx1, sy1 = cfg["chip_subrect"]
                x, bw2 = x + int(bw * sx0), int(bw * (sx1 - sx0))
                y, bh2 = y + int(bh * sy0), int(bh * (sy1 - sy0))
                bw, bh = bw2, bh2
            # small inward safety inset before autocrop -- detected contour
            # boxes sometimes include a 1-2px anti-aliased edge halo
            inset_x, inset_y = max(2, int(bw * 0.01)), max(2, int(bh * 0.01))
            crop = img[y + inset_y : y + bh - inset_y, x + inset_x : x + bw - inset_x]
            crop = autocrop_border(crop)

            if crop.size == 0 or crop.shape[0] < 40 or crop.shape[1] < 40:
                fallback += 1
                continue

            save(crop, os.path.join(out_dir, f"{cid}-swatch.webp"))
            written += 1

            pms = patch_mean_std(crop)
            if pms > 15:
                flagged.append((cid, page_idx + 1, round(pms, 1)))

        if (page_idx - start + 1) % 25 == 0:
            print(f"  page {page_idx + 1}: {written} written, {fallback} fallback so far")

    doc.close()
    print(f"\n{args.family}: {written} swatches written, {fallback} pages had no detected region")
    if flagged:
        print(f"flagged for manual review ({len(flagged)}, patch_mean_std > 15 -- possible non-tile crop):")
        for cid, pg, score in flagged:
            print(f"  {cid}  (source page {pg}, score {score})")
    print(f"output: {os.path.relpath(out_dir, ROOT)}")


if __name__ == "__main__":
    main()
