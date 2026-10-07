/**
 * อาการร่วมรายบริเวณ — ถามเฉพาะบริเวณที่ผู้ใช้เลือก (ไม่ใช่รายการเดียวทุกคน)
 * ------------------------------------------------------------------
 * จากอาการของแต่ละโรคใน CPG แนวทางเวชปฏิบัติแพทย์แผนไทย (PCU) 2568 หน้า 144–150 (เลขหน้า PDF)
 * คัดเฉพาะที่ผู้ใช้ตอบเองได้ · ไม่ซ้ำกับคำถามอาการร้าว · ชา/อ่อนแรง = สัญญาณอันตราย ถามทุกบริเวณแยกต่างหาก
 * key = คีย์แนวทาง (treatmentGuides) ของบริเวณนั้น
 */
import { guideKeyOf, regionOf } from './treatmentGuides';

type Assoc = { label: string; ref: string };

const SWELL: Assoc = { label: 'บวม แดง ร้อน', ref: 'CPG หน้า 145–149 (ลมปราบ ลมลำบอง ลมจับโปง ข้อเบี่ยง)' };
const NECK_BACK: Assoc[] = [
  { label: 'หายใจไม่เต็มที่', ref: 'CPG หน้า 145 (ลมปลายปัตฆาต หลัง-คอ U57.33)' },
  { label: 'ขัดยอกหน้าอก', ref: 'CPG หน้า 145, 149 (U57.33 · ตกหมอน U71.80)' },
];

export const ASSOCIATED: Record<string, Assoc[]> = {
  head: [
    { label: 'ปวดกระบอกตา', ref: 'CPG หน้า 148 (ลมปะกัง U61.2)' },
    { label: 'ตาลาย เห็นแสงระยิบระยับ', ref: 'CPG หน้า 148 (ลมปะกัง U61.2)' },
    { label: 'หน้าแดง', ref: 'CPG หน้า 148 (ลมปะกัง U61.2)' },
    { label: 'อาเจียน', ref: 'CPG หน้า 148 (ลมปะกัง U61.2)' },
  ],
  neck: [
    { label: 'ปวดศีรษะร่วมด้วย', ref: 'CPG หน้า 144, 149 (โค้งคอ U57.30 · ตกหมอน U71.80)' },
    { label: 'ปวดกระบอกตา', ref: 'CPG หน้า 144 (โค้งคอ U57.30)' },
    { label: 'หูอื้อ', ref: 'CPG หน้า 144 (โค้งคอ U57.30)' },
    ...NECK_BACK,
    { label: 'หันหน้าต้องหันทั้งตัว', ref: 'CPG หน้า 149 (ตกหมอน คอเคล็ด U71.80)' },
  ],
  scapula: NECK_BACK,
  upperBack: NECK_BACK,
  shoulder: [
    { label: 'ยกแขนได้ไม่สูง', ref: 'CPG หน้า 148 (หัวไหล่ติด U71.00 · หัวไหล่เบี่ยง U71.01)' },
    { label: 'มือไพล่หลังไม่ได้', ref: 'CPG หน้า 148 (หัวไหล่ติด U71.00)' },
    SWELL,
  ],
  lowerBack: [
    { label: 'ปวดใต้หัวเข่า', ref: 'CPG หน้า 145 (ลมปลายปัตฆาต หลัง U57.31)' },
    { label: 'หันตัวไม่ถนัด เดินตัวแข็ง', ref: 'CPG หน้า 150 (ยอกเดี่ยว U75.10)' },
    { label: 'ปวดมากเมื่อเปลี่ยนท่า', ref: 'CPG หน้า 150 (ยอกหลังคู่ U75.11)' },
    SWELL,
  ],
  hip: [{ label: 'เดินขากะเผลก', ref: 'CPG หน้า 148 (ข้อสะโพกเบี่ยง U71.30)' }],
  rib: [SWELL],
  arm: [
    { label: 'เจ็บเวลากำ บิด คว่ำมือ', ref: 'CPG หน้า 144 (ลมปลายปัตฆาตข้อศอก U57.23)' },
    { label: 'หยิบจับของไม่สะดวก', ref: 'CPG หน้า 148 (ข้อศอกเบี่ยง U71.10)' },
    SWELL,
  ],
  wrist: [
    { label: 'นิ้วฝืด กำไม่เข้า', ref: 'CPG หน้า 144 (นิ้วไกปืน U57.25)' },
    { label: 'นิ้วงอค้าง มีเสียงดัง', ref: 'CPG หน้า 144 (นิ้วไกปืน U57.25)' },
    SWELL,
  ],
  thigh: [{ label: 'กล้ามเนื้อแข็งเป็นก้อน', ref: 'CPG หน้า 144 (ลมปลายปัตฆาตขา U57.26)' }, SWELL],
  leg: [{ label: 'กล้ามเนื้อแข็งเป็นก้อน', ref: 'CPG หน้า 144 (ลมปลายปัตฆาตขา U57.26)' }, SWELL],
  knee: [
    SWELL,
    { label: 'มีน้ำในเข่า', ref: 'CPG หน้า 145, 146 (ลมจับโปงน้ำ U57.50 · ลมลำบองเข่า U57.62)' },
    { label: 'เข่าติด ขาโก่ง', ref: 'CPG หน้า 146, 149 (ลมจับโปงแห้ง U57.53 · เข่าเสื่อม U71.41)' },
    { label: 'นั่งยองไม่ได้', ref: 'CPG หน้า 146, 149' },
    { label: 'เข่ามีเสียงกร๊อบแกร๊บ', ref: 'CPG หน้า 146, 149' },
    { label: 'ปวดมากเวลาขึ้นบันได', ref: 'CPG หน้า 146, 149' },
  ],
  ankle: [
    SWELL,
    { label: 'ลงน้ำหนักไม่เต็มที่', ref: 'CPG หน้า 149 (ข้อเท้าเบี่ยง U71.62)' },
    { label: 'กระดกข้อเท้าลำบาก', ref: 'CPG หน้า 149 (ข้อเท้าเบี่ยง U71.62)' },
  ],
};
ASSOCIATED.lowerBackRadiating = ASSOCIATED.lowerBack;

/** ชา / อ่อนแรง — ถามทุกบริเวณ (สัญญาณทางเส้นประสาท · ตีความจาก CPG หน้า 139 ข้อ 3.1 รอแพทย์ยืนยัน) */
export const DANGER_SIGNS = ['ชาบริเวณที่ปวด', 'แขนหรือขาอ่อนแรง'];

/** อาการร่วมที่ถาม แบ่งตามบริเวณที่เลือก (บริเวณเดียวกัน/อาการซ้ำ = แสดงครั้งเดียว) */
export function associatedFor(symptoms: string[]): { title: string; options: string[] }[] {
  const seenKey = new Set<string>();
  const seenLabel = new Set<string>();
  const out: { title: string; options: string[] }[] = [];
  for (const s of symptoms) {
    const k = guideKeyOf(s);
    if (!k || seenKey.has(k) || !ASSOCIATED[k]) continue;
    seenKey.add(k);
    const options = ASSOCIATED[k].map((x) => x.label).filter((l) => !seenLabel.has(l));
    options.forEach((l) => seenLabel.add(l));
    if (options.length) out.push({ title: regionOf(s), options });
  }
  return out;
}

/** ทุกอาการร่วม (ใช้แยกอาการร่วมออกจากจุดที่ปวดในข้อมูลที่เลือก) */
export const ALL_ASSOCIATED = [...new Set([...Object.values(ASSOCIATED).flatMap((xs) => xs.map((x) => x.label)), ...DANGER_SIGNS])];
