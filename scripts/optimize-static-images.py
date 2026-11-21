#!/usr/bin/env python3
"""Create optimized WebP copies of checked-in storefront images and update source references.

Original JPEG/PNG files are deliberately retained as editable source assets.
"""
from pathlib import Path
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "public" / "images"
OUTPUT_DIR = IMAGE_DIR / "optimized"
SOURCE_DIRS = [ROOT / "src", ROOT / "index.html"]
SUPPORTED = {".jpg", ".jpeg", ".png"}
MAX_EDGE = 2400

def quality_for(path: Path) -> int:
    name = path.name.lower()
    if name.startswith("hero-"):
        return 86
    if "category" in name or "occasion" in name:
        return 83
    return 85

def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    converted = {}
    total_before = 0
    total_after = 0

    for source in sorted(IMAGE_DIR.iterdir()):
        if not source.is_file() or source.suffix.lower() not in SUPPORTED:
            continue
        target = OUTPUT_DIR / f"{source.stem}.webp"
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            image.save(
                target,
                "WEBP",
                quality=quality_for(source),
                method=6,
                optimize=True,
                exact=True,
            )
        before = source.stat().st_size
        after = target.stat().st_size
        total_before += before
        total_after += after
        converted[source.name] = f"/images/optimized/{target.name}"
        print(f"{source.name}: {before:,} -> {after:,} bytes")

    if not converted:
        print("No source JPG/JPEG/PNG images found; nothing to optimize.")
        return

    updated_files = 0
    text_extensions = {".ts", ".tsx", ".js", ".jsx", ".css", ".html", ".json"}
    for source_dir in SOURCE_DIRS:
        candidates = [source_dir] if source_dir.is_file() else source_dir.rglob("*")
        for path in candidates:
            if not path.is_file() or path.suffix.lower() not in text_extensions:
                continue
            try:
                original = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            updated = original
            for old_name, new_url in converted.items():
                updated = re.sub(
                    re.escape(f"/images/{old_name}"),
                    new_url,
                    updated,
                    flags=re.IGNORECASE,
                )
            if updated != original:
                path.write_text(updated, encoding="utf-8")
                updated_files += 1
                print(f"Updated references: {path.relative_to(ROOT)}")

    saved = total_before - total_after
    percent = (saved / total_before * 100) if total_before else 0
    print(
        f"\nOptimized {len(converted)} images; updated {updated_files} source files. "
        f"Source bytes: {total_before:,}; WebP bytes: {total_after:,}; "
        f"saved: {saved:,} bytes ({percent:.1f}%)."
    )

if __name__ == "__main__":
    main()
