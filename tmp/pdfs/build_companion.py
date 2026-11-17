import json
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
shots = json.loads(Path(__file__).with_name('screenshot-manifest.json').read_text(encoding='utf-8'))
shots = [s for s in shots if s['id'] != '00']
assert len(shots) == len({s['id'] for s in shots}) == 32
pdfmetrics.registerFont(TTFont('ArialBold', r'C:\Windows\Fonts\arialbd.ttf'))
W, H = A4
path = ROOT / 'output/pdf/LINKO-Updated-Website-Screenshot-Companion.pdf'
c = canvas.Canvas(str(path), pagesize=A4)
for s in shots:
    c.setFont('ArialBold', 18)
    c.drawString(38, H - 55, s['title'])
    image = ROOT / 'output/pdf/screenshots' / (s['id'] + '.png')
    with Image.open(image) as im:
        iw, ih = im.size
    scale = min((W - 76) / iw, (H - 110) / ih)
    width, height = iw * scale, ih * scale
    c.drawImage(str(image), (W - width) / 2, H - 75 - height, width=width, height=height)
    c.showPage()
c.save()
print(path)
