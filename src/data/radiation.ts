/**
 * อาการปวดร้าว — ปวดที่หนึ่งแล้วร้าวไปอีกที่ = โรคเดียวกัน (ไม่ใช่ 2 อาการแยก)
 * ------------------------------------------------------------------
 * ร้าวถึงไหน → ชื่อโรค/แนวทาง และความปลอดภัย (CPG แนวทางเวชปฏิบัติแพทย์แผนไทย (PCU) 2568)
 *   หลัง/เอว: ร้าวสะโพก ก้นย้อย ถึงหัวเข่า = ลมปลายปัตฆาตสัญญาณ 1 หลัง (หน้า 145)
 *             ร้าวชาถึงน่อง ฝ่าเท้า นิ้วเท้า = ลมลำบองสัญญาณ 3 หลัง (หน้า 146)
 *   คอ/บ่า/สะบัก: ร้าวชาแขนด้านนอกและนิ้วมือ = ลมปลายปัตฆาตสัญญาณ 4 หลัง-คอ (หน้า 145)
 *   ข้อศอก: ร้าวไปหัวไหล่ / ร้าวชาลงข้อมือ นิ้วมือ (หน้า 144) · ส้นเท้า: ร้าวขอบเท้า เอ็นร้อยหวาย (หน้า 144)
 *   สะโพก: ร้าวก้นย้อยลงต้นขา (หน้า 148)
 * ⚠️ "ร้าวเลยเข่า → แพทย์ตรวจก่อน" และ "อ่อนแรง → พบแพทย์ก่อน" (ชาถึงเข่ายังอยู่ใน U57.31) เป็นการตีความเกณฑ์ไม่รับรักษา
 *    "ปวดเกี่ยวกับระบบประสาท" (CPG หน้า 139) — CPG ไม่ได้ระบุระยะร้าวตรง ๆ · ให้แพทย์แผนไทยยืนยันก่อนใช้จริง
 */
import type { BodyPin } from '../design-system/components/Body3D';

export const NO_RADIATE = 'ไม่ร้าว';

export interface RadiateOption {
  label: string;
  /** บริเวณที่ร้าวไป (ซ้าย/ขวาตามข้างที่ปวด · ไม่บอกข้าง = ทั้งสองข้าง) */
  L: BodyPin[];
  R?: BodyPin[];
  /** ใช้แนวทางนี้แทนแนวทางของจุดที่ปวด */
  guideKey?: string;
  /** ผลต่อการคัดกรอง */
  level?: 'amber' | 'red';
  note?: string;
  source?: string;
}
interface RadiatePattern {
  /** คำในชื่ออาการที่ใช้รูปแบบนี้ (เรียงตามลำดับที่ตรวจ) */
  match: string[];
  /** ไม่ใช้กับอาการที่มีคำเหล่านี้ */
  except?: string[];
  options: RadiateOption[];
}

const PATTERNS: RadiatePattern[] = [
  {
    match: ['ปวดหลัง', 'เอว'],
    except: ['หลังส่วนบน'],
    options: [
      { label: 'ร้าวลงสะโพก ก้น', L: ['hipLeft', 'hipRight'], guideKey: 'lowerBackRadiating' },
      { label: 'ร้าวลงถึงเข่า', L: ['hipLeft', 'hipRight', 'thighBackLeft', 'thighBackRight', 'kneeBackLeft', 'kneeBackRight'], guideKey: 'lowerBackRadiating' },
      {
        label: 'ร้าวเลยเข่าถึงน่อง เท้า',
        L: ['hipLeft', 'hipRight', 'thighBackLeft', 'thighBackRight', 'calfLeft', 'calfRight', 'heelLeft', 'heelRight'],
        guideKey: 'lowerBackRadiating',
        level: 'amber',
        note: 'ร้าวเลยเข่า แพทย์ตรวจก่อนว่าเกี่ยวกับเส้นประสาทไหม',
        source: 'CPG หน้า 139, 146',
      },
      { label: 'ขาอ่อนแรง', L: [], level: 'red', note: 'ขาอ่อนแรง', source: 'CPG หน้า 139' },
    ],
  },
  {
    match: ['คอ', 'บ่า', 'สะบัก'],
    options: [
      { label: 'ร้าวไปสะบัก', L: ['scapulaLeft', 'scapulaRight'], guideKey: 'scapula' },
      {
        label: 'ร้าวชาลงแขน นิ้วมือ',
        L: ['armLeft', 'armRight', 'elbowLeft', 'elbowRight', 'handLeft', 'handRight'],
        guideKey: 'scapula',
        level: 'amber',
        note: 'ร้าวชาลงแขน แพทย์ตรวจก่อนว่าเกี่ยวกับเส้นประสาทไหม',
        source: 'CPG หน้า 139, 145',
      },
      { label: 'แขนอ่อนแรง', L: [], level: 'red', note: 'แขนอ่อนแรง', source: 'CPG หน้า 139' },
    ],
  },
  {
    match: ['ข้อศอก'],
    options: [
      { label: 'ร้าวขึ้นไหล่', L: ['shoulderLeft'], R: ['shoulderRight'] },
      { label: 'ร้าวชาลงข้อมือ นิ้วมือ', L: ['wristLeft', 'handLeft'], R: ['wristRight', 'handRight'] },
    ],
  },
  {
    match: ['ส้นเท้า'],
    options: [{ label: 'ร้าวไปขอบเท้า เอ็นร้อยหวาย', L: ['footLeft', 'footRight'] }],
  },
  {
    match: ['สะโพก'],
    options: [{ label: 'ร้าวลงต้นขา', L: ['thighBackLeft'], R: ['thighBackRight'] }],
  },
];

/** อาการแรกที่มีรูปแบบการร้าว (ถามข้อนี้เฉพาะอาการนั้น) */
export function radiateFor(symptoms: string[]): { symptom: string; options: string[] } | null {
  for (const s of symptoms) {
    const p = PATTERNS.find((x) => x.match.some((w) => s.includes(w)) && !x.except?.some((w) => s.includes(w)));
    if (p) return { symptom: s, options: [NO_RADIATE, ...p.options.map((o) => o.label)] };
  }
  return null;
}

/** ตัวเลือกที่ตอบ → รายละเอียด (บริเวณที่ร้าว · ผลคัดกรอง · แนวทาง) */
export function radiateOption(label: string | undefined): RadiateOption | undefined {
  if (!label || label === NO_RADIATE) return undefined;
  return PATTERNS.flatMap((p) => p.options).find((o) => o.label === label);
}

/** หมุดบริเวณที่ร้าวไป ตามข้างที่ปวด */
export function radiatePins(label: string | undefined, symptom: string | undefined): BodyPin[] {
  const o = radiateOption(label);
  if (!o) return [];
  if (!o.R) return o.L;
  return symptom?.endsWith('ซ้าย') ? o.L : symptom?.endsWith('ขวา') ? o.R : [...o.L, ...o.R];
}

export const ALL_RADIATE_OPTIONS = [NO_RADIATE, ...new Set(PATTERNS.flatMap((p) => p.options.map((o) => o.label)))];
