"""
สร้างคลังความรู้สำหรับให้ AI ค้น (RAG ในแอป) จากไฟล์ใน `knowledge hub/`
- ดึงข้อความรายหน้า (PyMuPDF) · ไฟล์ที่ฟอนต์ถอดรหัสผิด ใช้ข้อความ OCR แทน (ส่งพาธมาใน --ocr)
- ทำความสะอาดอักขระเพี้ยนจากการถอดฟอนต์ไทย (ę Ě � ² ³ ˑ วรรณยุกต์ซ้ำ)
- ผลลัพธ์: assets/kb/kb.txt — 1 บรรทัด = 1 หน้า (JSON {f: ชื่อเอกสาร, p: หน้า PDF, t: ข้อความ})
ใช้: python scripts/build-kb.py --ocr "เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย=path/kg.txt" ...
"""
import argparse, glob, json, os, re, sys
import fitz  # PyMuPDF

ROOT = os.path.join(os.path.dirname(__file__), '..')
HUB = os.path.join(ROOT, 'knowledge hub')
OUT = os.path.join(ROOT, 'assets', 'kb', 'kb.txt')

# ชื่อสั้นที่ AI ใช้อ้างอิง
TITLE = {
    'CPG_PCU': 'CPG แนวทางเวชปฏิบัติแพทย์แผนไทย (PCU)',
    'ตำราอ้างอิงด้านการแพทย์แผนไทย': 'ตำราอ้างอิงด้านการแพทย์แผนไทย',
    'เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย': 'เกณฑ์มาตรฐานและกรรมวิธีการแพทย์แผนไทย',
    'คู่มือพจนานุกรมศัพท์การแพทย์และเภสัชกรรมแผนไทยที่เกี่ยวข้องกับการนวดไทย': 'พจนานุกรมศัพท์การนวดไทย',
    'KH_นวดไทย': 'องค์ความรู้การนวดไทย (KH)',
    'ยืดเหยียด 7 กลุ่มอาการ': 'ยืดเหยียด 7 กลุ่มอาการ',
    'เวลเนสสัญจร-2568-B5-1-6': 'เวลเนสสัญจร 2568',
    'health_profile_publish_2568': 'Health Profile 2568',
    'Health_at_a_glance_2026': 'Health at a Glance 2026',
    'e-book final การท่องเที่ยวเชิงสุขภาพ': 'การท่องเที่ยวเชิงสุขภาพ',
}

TONE = '่้๊๋็์'

# อักขระเพี้ยนที่อยู่ระหว่างตัวไทย: บางตัวคือวรรณยุกต์ (ดูจากบริบท เช่น การทĔองเที่ยว = ท่อง) ที่เหลือเป็นขยะ → ตัดทิ้ง
TONE_MAP = {'Ĕ': '่', 'ĕ': '้', 'c': '่', 'f': '้'}
GLYPH = re.compile('(?<=[฀-๿])([^฀-๿\\s\\d.,()\\-:/"“”\'%])(?=[฀-๿])')

def clean(t: str) -> str:
    t = re.sub('[ęĚŠ�²³ˑ­]', '', t)
    t = GLYPH.sub(lambda m: TONE_MAP.get(m.group(1), ''), t)
    t = re.sub(f'([{TONE}ัิ-ฺ])\\1+', r'\1', t)  # สระ/วรรณยุกต์ซ้ำ
    t = re.sub(r'[ \t ]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    return t.strip()

def thai_ratio(t: str) -> float:
    th = sum(1 for c in t if '฀' <= c <= '๿')
    return th / max(1, len(t))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ocr', action='append', default=[], help='ชื่อไฟล์(ไม่มี .pdf)=พาธข้อความ OCR (มี "=== หน้า N ===")')
    a = ap.parse_args()
    ocr = dict(x.split('=', 1) for x in a.ocr)
    rows = []
    for pdf in sorted(glob.glob(os.path.join(HUB, '*.pdf'))):
        stem = os.path.splitext(os.path.basename(pdf))[0]
        title = TITLE.get(stem, stem)
        pages = []
        if stem in ocr:
            txt = open(ocr[stem], encoding='utf8').read()
            for m in re.finditer(r'=== หน้า (\d+) ===\n(.*?)(?==== หน้า|\Z)', txt, re.S):
                pages.append((int(m.group(1)), m.group(2)))
        else:
            d = fitz.open(pdf)
            pages = [(i + 1, d[i].get_text()) for i in range(len(d))]
        kept = 0
        for p, t in pages:
            t = clean(t)
            if len(t) < 120 or thai_ratio(t) < 0.25:
                continue
            # หน้ายาวมาก → แบ่งครึ่ง (ให้ท่อนที่ส่ง AI ไม่ใหญ่เกิน)
            for i in range(0, len(t), 2400):
                rows.append({'f': title, 'p': p, 't': t[i:i + 2600]})
            kept += 1
        print(f'{title}: {kept}/{len(pages)} หน้า', file=sys.stderr)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf8') as o:
        for r in rows:
            o.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'{len(rows)} ท่อน · {os.path.getsize(OUT)/1e6:.1f} MB → {OUT}', file=sys.stderr)

if __name__ == '__main__':
    main()
