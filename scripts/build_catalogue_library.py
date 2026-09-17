"""Build faithful, uncropped page previews for the four supplied catalogues.

Usage: python scripts/build_catalogue_library.py --source-dir C:/path/to/pdfs

The PDFs are copied byte-for-byte. This does not author, repair, crop or recolour
them. Page previews are derived display assets; the original PDF remains the
authority for every printed product name, finish, size and specification.

Dependencies: pypdfium2, Pillow (available in the Codex bundled Python runtime).
The generated library is committed so deployment does not require Python.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import statistics

import pypdfium2 as pdfium
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "catalogues"
MANIFEST = ROOT / "src" / "data" / "catalogueBooks.generated.json"
SETTINGS = {"version": 1, "previewEdge": 1800, "detailEdge": 3600,
            "thumbnailEdge": 280, "previewQuality": 84, "detailQuality": 90,
            "thumbnailQuality": 78}

BOOKS = [
    {"id": "global-floor", "title": "Global Floor Collection",
     "description": "Large-format floor tiles, room settings and printed product specifications.",
     "format": "Floor tiles", "sourceName": "GLOBAL TILES FLOOR CATALOGUE.pdf",
     "featuredPage": 3},
    {"id": "global-wall", "title": "Global Wall Collection",
     "description": "Wall tile designs, coordinated room settings and printed product specifications.",
     "format": "Wall tiles", "sourceName": "GLOBAL TILES 2025 CATALOGUE.pdf",
     "featuredPage": 3},
    {"id": "sky", "title": "SKY Wall Collection",
     "description": "300 × 450 mm wall tiles, with coordinated designs and room settings.",
     "format": "12 × 18 in · Wall tiles", "sourceName": "(12X18) SKY PDF.pdf",
     "featuredPage": 37},
    {"id": "sunflora", "title": "Sunflora Collection",
     "description": "The supplied Sunflora catalogue: 600 × 1200 mm surfaces and technical details.",
     "format": "600 × 1200 mm · 2 × 4 ft", "sourceName": "SUNFLORA 2X4 (NEW DES).pdf",
     "featuredPage": 3},
]


def digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def native_page_scale(page) -> float:
    """Avoid enlarging embedded scans beyond their native effective resolution.

    Use the median effective image DPI so small logos or rotated decorative
    images cannot dictate an excessively large render. Vector artwork and
    outlines still render cleanly at this scale. A page without raster images
    can use the configured detail resolution directly.
    """
    dpi = []
    for obj in page.get_objects():
        if isinstance(obj, pdfium.PdfImage):
            meta = obj.get_metadata()
            effective = min(meta.horizontal_dpi, meta.vertical_dpi)
            if effective > 0:
                dpi.append(effective)
    target = SETTINGS["detailEdge"] / max(page.get_size())
    return min(target, statistics.median(dpi) / 72) if dpi else target


def write_webp(image: Image.Image, path: Path, edge: int, quality: int) -> None:
    version = image.copy()
    version.thumbnail((edge, edge), Image.Resampling.LANCZOS)
    # No colour, sharpening, contrast or crop transforms: preserve the source.
    version.save(path, "WEBP", quality=quality, method=5)
    version.close()


def build_book(task: tuple[dict, str, dict | None]) -> dict:
    book, source_dir, previous = task
    original = Path(source_dir) / book["sourceName"]
    if not original.is_file():
        # Rebuilding from committed originals is supported without Downloads.
        original = OUTPUT / f"{book['id']}.pdf"
    if not original.is_file():
        raise FileNotFoundError(f"Catalogue not found: {book['sourceName']}")
    source_hash = digest(original)
    copied_pdf = OUTPUT / f"{book['id']}.pdf"
    if original.resolve() != copied_pdf.resolve():
        if not copied_pdf.is_file() or digest(copied_pdf) != source_hash:
            shutil.copyfile(original, copied_pdf)
    if digest(copied_pdf) != source_hash:
        raise RuntimeError(f"Original PDF copy failed integrity check: {book['id']}")

    page_dir = OUTPUT / book["id"]
    page_dir.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(copied_pdf)
    pages = []
    text_pages = 0
    for index in range(len(document)):
        number = index + 1
        page = document[index]
        text_page = page.get_textpage()
        text = text_page.get_text_range().strip()
        text_page.close()
        text_pages += bool(text)
        stem = f"page-{number:03}"
        preview = page_dir / f"{stem}.webp"
        detail = page_dir / f"{stem}-detail.webp"
        thumb = page_dir / f"{stem}-thumb.webp"
        cache_valid = (
            previous and previous.get("sourceHash") == source_hash
            and previous.get("renderSettings") == SETTINGS
            and all(path.is_file() and path.stat().st_size for path in (preview, detail, thumb))
        )
        if not cache_valid:
            bitmap = page.render(scale=native_page_scale(page))
            image = bitmap.to_pil().convert("RGB")
            write_webp(image, detail, SETTINGS["detailEdge"], SETTINGS["detailQuality"])
            write_webp(image, preview, SETTINGS["previewEdge"], SETTINGS["previewQuality"])
            write_webp(image, thumb, SETTINGS["thumbnailEdge"], SETTINGS["thumbnailQuality"])
            image.close()
            bitmap.close()
        width, height = page.get_size()
        with Image.open(detail) as rendered:
            detail_width, detail_height = rendered.size
        pages.append({
            "number": number, "width": round(width, 3), "height": round(height, 3),
            "image": f"/catalogues/{book['id']}/{preview.name}",
            "detailImage": f"/catalogues/{book['id']}/{detail.name}",
            "thumbnail": f"/catalogues/{book['id']}/{thumb.name}",
            "detailWidth": detail_width, "detailHeight": detail_height,
            "text": text,
        })
        page.close()
    document.close()
    total_assets = sum(path.stat().st_size for path in page_dir.glob("*.webp"))
    print(f"{book['id']}: {len(pages)} complete pages; {text_pages} text layers; "
          f"{total_assets / 1_000_000:.1f} MB derived assets", flush=True)
    return {
        **book, "pdfUrl": f"/catalogues/{book['id']}.pdf",
        "fileSize": copied_pdf.stat().st_size, "sourceHash": source_hash,
        "pageCount": len(pages), "cover": pages[0]["image"],
        "thumbnail": pages[0]["thumbnail"],
        "textPageCount": text_pages,
        "detailsNote": "Read the product names, sizes, finishes and other specifications printed on each original catalogue page. Zoom in for a closer view.",
        "renderSettings": SETTINGS, "pages": pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=OUTPUT,
                        help="Directory containing the four user-supplied PDFs")
    parser.add_argument("--workers", type=int, default=2,
                        help="Separate renderer processes; PDFium is not thread-safe")
    args = parser.parse_args()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    previous = {}
    if MANIFEST.is_file():
        previous = {book["id"]: book for book in json.loads(MANIFEST.read_text(encoding="utf-8"))}
    tasks = [(book, str(args.source_dir), previous.get(book["id"])) for book in BOOKS]
    with ProcessPoolExecutor(max_workers=max(1, min(args.workers, 4))) as executor:
        results = list(executor.map(build_book, tasks))
    MANIFEST.write_text(json.dumps(results, ensure_ascii=False, separators=(",", ":")) + "\n",
                        encoding="utf-8")
    print(f"Library complete: {len(results)} catalogues / "
          f"{sum(book['pageCount'] for book in results)} pages. {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
