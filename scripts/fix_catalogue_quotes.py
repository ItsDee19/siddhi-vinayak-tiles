"""Fix unescaped quotes in importedCatalogue.js name fields."""
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "src" / "data" / "importedCatalogue.js"
t = p.read_text(encoding="utf-8")

# Fix known broken c092
t2, n = re.subn(
    r'("id":\s*"gt-floor-c092",\s*\n\s*"name":\s*")[^\n]*(")',
    r'\1Global Floor Tile #92\2',
    t,
    count=1,
)
print("fixed c092", n)

# Any name value containing an unescaped " will break JS — sanitize remaining
def fix_name_line(m):
    pre, val, post = m.group(1), m.group(2), m.group(3)
    # if val has internal quotes already broken across, handled above
    safe = val.replace('"', "'")
    return f'{pre}{safe}{post}'

# Only match proper single-line name fields
t3, n2 = re.subn(r'("name":\s*")([^"\n]*)(")', fix_name_line, t2)
print("name fields scanned", n2)

# Detect remaining lines with too many quotes
bad = []
for i, line in enumerate(t3.splitlines(), 1):
    if '"name":' in line and line.count('"') not in (3, 4):
        # "name": "value" => 4 quotes; empty name "name": "" => 4
        bad.append((i, line[:120]))
print("suspicious lines", len(bad))
for b in bad[:20]:
    print(b)

p.write_text(t3, encoding="utf-8")
print("wrote", p)
