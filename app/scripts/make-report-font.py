from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from pathlib import Path
import json,shutil,tempfile
root=Path(__file__).resolve().parents[1]
work=Path(tempfile.mkdtemp(prefix='ryadom-font-'))
paths=[]
for subset in ['latin','cyrillic','cyrillic-ext','latin-ext']:
 f=TTFont(root/f'node_modules/@fontsource/manrope/files/manrope-{subset}-400-normal.woff');f.flavor=None
 p=str(work/f'manrope-{subset}.ttf');f.save(p);paths.append(p)
f=Merger().merge(paths)
out=root/'public/fonts';out.mkdir(exist_ok=True)
f.save(out/'report-manrope.ttf')
scale=1000/f['head'].unitsPerEm
metrics={str(cp):[f.getGlyphID(g),round(f['hmtx'][g][0]*scale)] for cp,g in f.getBestCmap().items()}
(out/'report-manrope.json').write_text(json.dumps({'characters':metrics,'bbox':[round(x*scale) for x in [f['head'].xMin,f['head'].yMin,f['head'].xMax,f['head'].yMax]],'ascent':round(f['hhea'].ascent*scale),'descent':round(f['hhea'].descent*scale)},separators=(',',':')))
shutil.copy(root/'node_modules/@fontsource/manrope/LICENSE',out/'Manrope-LICENSE.txt')
shutil.rmtree(work)
print(len(metrics),(out/'report-manrope.ttf').stat().st_size)
