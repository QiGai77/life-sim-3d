#!/usr/bin/env python3
"""
Subset LXGW WenKai (OFL-1.1) to exactly the glyphs the game uses.

usage:  python3 scripts/subset-font.py /path/to/LXGWWenKai-Medium.ttf
(download: https://github.com/lxgw/LxgwWenKai/releases  -> LXGWWenKai-Medium.ttf)
needs:  pip install fonttools brotli
writes: public/fonts/wenkai-sub.woff2
Re-run whenever UI text changes.
"""
import pathlib, re, sys
from fontTools import subset

root = pathlib.Path(__file__).resolve().parent.parent
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/font/WenKai-Medium.ttf'
chars = set()
for p in list((root / 'src').rglob('*.ts')) + [root / 'index.html', root / 'src/ui/style.css']:
    chars |= set(p.read_text(encoding='utf-8'))
chars |= set(chr(c) for c in range(0x20, 0x7f))
chars |= set('，。！？…～「」『』（）：；·—、“”‘’《》%+-/0123456789')
text = ''.join(sorted(c for c in chars if c.isprintable()))
cjk = [c for c in text if ord(c) > 0x2e80]
out = root / 'public/fonts/wenkai-sub.woff2'
out.parent.mkdir(parents=True, exist_ok=True)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.name_IDs = ['*']
opts.notdef_outline = True
font = subset.load_font(src, opts)
s = subset.Subsetter(opts)
s.populate(text=text)
s.subset(font)
subset.save_font(font, str(out), opts)
print(f'{len(text)} glyphs ({len(cjk)} CJK) -> {out} {out.stat().st_size // 1024} KB')
