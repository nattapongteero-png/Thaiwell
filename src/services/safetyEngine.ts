/**
 * SAFETY RULE ENGINE (deterministic) — ตาม Concept Paper ข้อ 4.4
 * ------------------------------------------------------------------
 * - เรื่องความปลอดภัย "ไม่ใช้ Generative AI ตัดสิน" → ใช้กฎที่กำหนดล่วงหน้า
 * - ทุกผลลัพธ์ trace กลับไปที่ rule id + ข้อมูลต้นทาง + เอกสารอ้างอิง (ไฟล์/หน้า) ได้
 *
 * แหล่งที่มา (knowledge hub/E-book/, เลขหน้า = PDF page index):
 *   REF = ตำราอ้างอิงด้านการแพทย์แผนไทย.pdf · CPG = CPG_PCU.pdf · YD = ยืดเหยียด 7 กลุ่มอาการ.pdf
 *
 * เกณฑ์ในเอกสารไม่ตรงกันบางข้อ (ความดัน: REF p.391 ≥160/100 vs REF p.401 >140/90 vs CPG p.139 ≤160/90,
 * ไข้: REF p.391 >38.5 vs REF p.402 >38 vs CPG p.139 ≤37.5) — ค่าที่ใช้ด้านล่างเป็นการรวมเกณฑ์
 * แบบระมัดระวังที่สุด ⚠️ ต้องให้แพทย์แผนไทยผู้รับผิดชอบรับรองก่อนใช้งานจริง
 */
import type { SafetyLevel } from '../design-system/components/Feedback';

export interface HealthProfile {
  /** false = ยังไม่ได้กรอกโรค/ยา/แพ้ (ผู้ใช้ใหม่ — Health ID ไม่ส่งข้อมูลสุขภาพมา) */
  healthKnown?: boolean;
  /** เชื่อมประวัติจากโรงพยาบาลแล้ว (ชื่อแหล่งข้อมูล) */
  phrSource?: string;
  age: number;
  conditions: string[]; // เช่น 'ความดันโลหิตสูง', 'เบาหวาน', 'กระดูกพรุน', 'โรคหัวใจ'
  medications: string[];
  allergies: string[];
  pregnant: boolean;
  /** เดือนที่ตั้งครรภ์ (ถ้าทราบ) */
  pregnancyMonth?: number;
  surgeryWithin1Month: boolean;
  injuryWithin48h: boolean;
  bp?: { sys: number; dia: number };
  /** หน้ามืด ใจสั่น ปวดศีรษะ หรือคลื่นไส้อาเจียน ร่วมกับความดันสูง */
  bpSymptoms: boolean;
  temperature?: number;
  pulse?: number;
  flags: {
    dvt: boolean;
    openWoundOrSkinInfection: boolean;
    unhealedFracture: boolean;
    cancerSite: boolean;
    acuteInfection: boolean;
  };
  symptoms: {
    suddenNumbnessOrWeakness: boolean;
    slurredSpeechOrFacialDroop: boolean;
    chestTightOrBreathless: boolean;
    unilateralCalfSwelling: boolean;
  };
}

export interface RuleHit {
  ruleId: string;
  level: Exclude<SafetyLevel, 'green'>;
  title: string;
  /** ข้อมูลต้นทางที่ทำให้กฎนี้ทำงาน */
  evidence: string;
  /** สิ่งที่ผู้ให้บริการควรทำ */
  action: string;
  /** เอกสารอ้างอิงของกฎ */
  source: string;
}

interface Rule {
  id: string;
  level: RuleHit['level'];
  title: string;
  action: string;
  source: string;
  test: (p: HealthProfile) => string | null;
}

const hasCondition = (p: HealthProfile, ...names: string[]) => p.conditions.some((c) => names.includes(c));
const bpHigh = (p: HealthProfile, sys: number, dia: number) => !!p.bp && (p.bp.sys >= sys || p.bp.dia >= dia);
const bpText = (p: HealthProfile) => (p.bp ? `BP ${p.bp.sys}/${p.bp.dia} mmHg` : '');

export const RULES: Rule[] = [
  // ---------------- RED: หยุดบริการ / ส่งต่อแพทย์ ----------------
  {
    id: 'RF-01',
    level: 'red',
    title: 'ความดันโลหิตสูงร่วมกับมีอาการ',
    action: 'ห้ามนวด ส่งต่อแพทย์',
    source: 'ตำราอ้างอิงฯ หน้า 391 (ข้อห้าม)',
    test: (p) => (bpHigh(p, 160, 100) && p.bpSymptoms ? `${bpText(p)} ร่วมกับหน้ามืด/ใจสั่น/ปวดศีรษะ/คลื่นไส้` : null),
  },
  {
    id: 'RF-02',
    level: 'red',
    title: 'ความดันโลหิตเกินเกณฑ์ส่งต่อ',
    action: 'ให้นอนพัก 30 นาทีแล้ววัดซ้ำ ถ้ายังเกิน 160/100 ส่งต่อแพทย์',
    source: 'CPG_PCU หน้า 139 (เกณฑ์ส่งต่อ)',
    test: (p) => (p.bp && (p.bp.sys > 160 || p.bp.dia > 100) && !p.bpSymptoms ? `${bpText(p)} (> 160/100)` : null),
  },
  {
    id: 'RF-03',
    level: 'red',
    title: 'มีไข้',
    action: 'งดนวด (ไข้ > 38.5 °C เป็นข้อห้าม) ส่งต่อแพทย์',
    source: 'ตำราอ้างอิงฯ หน้า 391, 401 · CPG_PCU หน้า 139',
    test: (p) => (p.temperature !== undefined && p.temperature > 38 ? `อุณหภูมิ ${p.temperature} °C (> 38)` : null),
  },
  {
    id: 'RF-04',
    level: 'red',
    title: 'ชีพจรผิดปกติ',
    action: 'ส่งต่อแพทย์',
    source: 'CPG_PCU หน้า 139 (เกณฑ์ส่งต่อ)',
    test: (p) => (p.pulse !== undefined && (p.pulse < 60 || p.pulse > 100) ? `ชีพจร ${p.pulse} ครั้ง/นาที (ปกติ 60–100)` : null),
  },
  {
    id: 'RF-05',
    level: 'red',
    title: 'อาการทางระบบประสาทเฉียบพลัน',
    action: 'หยุดกระบวนการ ส่งต่อแพทย์ฉุกเฉิน (1669)',
    source: 'ยืดเหยียด 7 กลุ่มอาการ หน้า 1 · CPG_PCU หน้า 139 (เกณฑ์คัดออก: ปวดเกี่ยวกับระบบประสาท)',
    test: (p) => {
      const s = [
        p.symptoms.suddenNumbnessOrWeakness && 'ชา/อ่อนแรงเฉียบพลัน',
        p.symptoms.slurredSpeechOrFacialDroop && 'พูดไม่ชัด/หน้าเบี้ยว',
      ].filter(Boolean);
      return s.length ? s.join(', ') : null;
    },
  },
  {
    id: 'RF-06',
    level: 'red',
    title: 'อึดอัด หายใจไม่สะดวก ใจสั่น',
    action: 'หยุดนวดทันที ปฐมพยาบาล ประเมินเพื่อส่งต่อแพทย์',
    source: 'CPG_PCU หน้า 62–63',
    test: (p) => (p.symptoms.chestTightOrBreathless ? 'แจ้งว่าอึดอัด หายใจไม่สะดวก หรือใจสั่น' : null),
  },
  {
    id: 'RF-07',
    level: 'red',
    title: 'สงสัยหลอดเลือดดำอักเสบ (DVT)',
    action: 'ห้ามนวดบริเวณขา ส่งต่อแพทย์',
    source: 'ตำราอ้างอิงฯ หน้า 391 (ข้อห้าม)',
    test: (p) => (p.flags.dvt || p.symptoms.unilateralCalfSwelling ? 'น่องบวม แดง ร้อน ข้างเดียว / ประวัติ DVT' : null),
  },
  {
    id: 'RF-08',
    level: 'red',
    title: 'ติดเชื้อเฉียบพลัน / โรคติดต่อ',
    action: 'งดนวด (รวมไข้พิษ ไข้กาฬ อีสุกอีใส งูสวัด วัณโรค)',
    source: 'ตำราอ้างอิงฯ หน้า 391, 401 (ข้อห้าม) · CPG_PCU หน้า 139',
    test: (p) => (p.flags.acuteInfection ? 'มีโรคติดเชื้อเฉียบพลันหรือโรคติดต่อ' : null),
  },
  {
    id: 'RF-09',
    level: 'red',
    title: 'ตั้งครรภ์เดือนที่ 3 หรือ 7',
    action: 'ไม่ทำการนวดในเดือนนี้',
    source: 'ตำราอ้างอิงฯ หน้า 401',
    test: (p) => (p.pregnant && (p.pregnancyMonth === 3 || p.pregnancyMonth === 7) ? `ตั้งครรภ์เดือนที่ ${p.pregnancyMonth}` : null),
  },
  {
    id: 'RF-10',
    level: 'red',
    title: 'ความดันโลหิตต่ำ',
    action: 'งดนวด ส่งต่อแพทย์',
    source: 'CPG_PCU หน้า 139 (เกณฑ์ไม่รับ/ส่งต่อ)',
    test: (p) => (p.bp && (p.bp.sys < 90 || p.bp.dia < 60) ? `${bpText(p)} (< 90/60)` : null),
  },
  {
    // เดิมเป็นข้อควรระวัง (ตำราฯ หน้า 391) — CPG หน้า 139 และตำราฯ หน้า 401 จัดเป็นข้อห้าม → ใช้เกณฑ์ที่ระมัดระวังกว่า
    id: 'RF-11',
    level: 'red',
    title: 'ใช้ยาละลายลิ่มเลือด / เลือดออกง่าย',
    action: 'งดนวด ปรึกษาแพทย์ก่อน',
    source: 'CPG_PCU หน้า 139 · ตำราอ้างอิงฯ หน้า 401 (ข้อห้าม)',
    test: (p) => {
      const m = p.medications.find((x) => /warfarin|aspirin|clopidogrel|แอสไพริน|ละลายลิ่มเลือด/i.test(x));
      return m ? `ยาที่ใช้: ${m}` : hasCondition(p, 'เลือดออกง่าย') ? 'เลือดออกง่าย' : null;
    },
  },
  // ---------------- AMBER: ให้บริการได้ แต่ต้องปรับ / งดเฉพาะบริเวณ ----------------
  {
    id: 'CA-01',
    level: 'amber',
    title: 'ความดันโลหิตสูง',
    action: 'กดนวดด้วยความระมัดระวัง ไม่นวดแรงเกินไป · งดอบสมุนไพร',
    source: 'ตำราอ้างอิงฯ หน้า 401, 415 · CPG_PCU หน้า 62',
    test: (p) =>
      (bpHigh(p, 141, 91) || hasCondition(p, 'ความดันโลหิตสูง')) && !(p.bp && (p.bp.sys > 160 || p.bp.dia > 100))
        ? [hasCondition(p, 'ความดันโลหิตสูง') && 'โรคประจำตัว: ความดันโลหิตสูง', p.bp && `วัดวันนี้ ${p.bp.sys}/${p.bp.dia}`].filter(Boolean).join(' · ')
        : null,
  },
  {
    id: 'CA-02',
    level: 'amber',
    title: 'ไข้ต่ำ ๆ เกินเกณฑ์รับบริการ',
    action: 'เลื่อนบริการจนอุณหภูมิ ≤ 37.5 °C',
    source: 'CPG_PCU หน้า 139 (เกณฑ์รับเข้า)',
    test: (p) => (p.temperature !== undefined && p.temperature > 37.5 && p.temperature <= 38 ? `อุณหภูมิ ${p.temperature} °C` : null),
  },
  {
    id: 'CA-04',
    level: 'amber',
    title: 'ตั้งครรภ์',
    action: 'ให้บริการโดยผู้ผ่านการอบรม ท่าตะแคง · งดอบสมุนไพร',
    source: 'ตำราอ้างอิงฯ หน้า 391, 401, 415',
    test: (p) => (p.pregnant && p.pregnancyMonth !== 3 && p.pregnancyMonth !== 7 ? `ตั้งครรภ์${p.pregnancyMonth ? `เดือนที่ ${p.pregnancyMonth}` : ''}` : null),
  },
  {
    id: 'CA-05',
    level: 'amber',
    title: 'บาดเจ็บภายใน 48 ชั่วโมง',
    action: 'ห้ามนวดบริเวณที่บาดเจ็บ · ห้ามประคบร้อนใน 24 ชม.แรก',
    source: 'ตำราอ้างอิงฯ หน้า 391, 414 · CPG_PCU หน้า 103, 139',
    test: (p) => (p.injuryWithin48h ? 'แจ้งว่ามีอุบัติเหตุ/บาดเจ็บภายใน 48 ชม.' : null),
  },
  {
    id: 'CA-06',
    level: 'amber',
    title: 'ผ่าตัดภายใน 1 เดือน',
    action: 'ห้ามนวดบริเวณที่ผ่าตัด',
    source: 'ตำราอ้างอิงฯ หน้า 391',
    test: (p) => (p.surgeryWithin1Month ? 'มีประวัติผ่าตัดภายใน 1 เดือน' : null),
  },
  {
    id: 'CA-07',
    level: 'amber',
    title: 'แผลเปิด โรคผิวหนัง กระดูกยังไม่ติด หรือบริเวณมะเร็ง',
    action: 'ห้ามนวดและห้ามประคบบริเวณนั้น',
    source: 'ตำราอ้างอิงฯ หน้า 391 · CPG_PCU หน้า 103',
    test: (p) => {
      const s = [
        p.flags.openWoundOrSkinInfection && 'แผลเปิด/โรคผิวหนัง',
        p.flags.unhealedFracture && 'กระดูกหักที่ยังไม่ติด',
        p.flags.cancerSite && 'บริเวณที่เป็นมะเร็ง',
      ].filter(Boolean);
      return s.length ? s.join(', ') : null;
    },
  },
  {
    id: 'CA-08',
    level: 'amber',
    title: 'เบาหวาน',
    action: 'ระวังความร้อนจากลูกประคบ (รับรู้ช้า ไหม้พองง่าย) · งดอบสมุนไพรหากยังคุมไม่ได้',
    source: 'ตำราอ้างอิงฯ หน้า 391, 414 · CPG_PCU หน้า 103',
    test: (p) => (hasCondition(p, 'เบาหวาน') ? 'โรคประจำตัว: เบาหวาน' : null),
  },
  {
    id: 'CA-10',
    level: 'amber',
    title: 'หอบหืด',
    action: 'งดอบสมุนไพร · หยุดนวดทันทีถ้าหายใจไม่สะดวก',
    source: 'ตำราอ้างอิงฯ หน้า 490 · CPG_PCU หน้า 62–63',
    test: (p) => (hasCondition(p, 'หอบหืด') ? 'โรคประจำตัว: หอบหืด' : null),
  },
  {
    id: 'CA-09',
    level: 'amber',
    title: 'ผู้สูงอายุ / กระดูกพรุน',
    action: 'แรงกดเบา เลี่ยงการดัดรุนแรง (กระดูกพรุนรุนแรง = ห้ามนวด)',
    source: 'ตำราอ้างอิงฯ หน้า 391',
    test: (p) => (p.age >= 60 || hasCondition(p, 'กระดูกพรุน') ? [p.age >= 60 && `อายุ ${p.age} ปี`, hasCondition(p, 'กระดูกพรุน') && 'กระดูกพรุน'].filter(Boolean).join(' · ') : null),
  },
];

export interface SafetyResult {
  level: SafetyLevel;
  hits: RuleHit[];
  checkedRules: number;
  evaluatedAt: string;
}

export function evaluateSafety(p: HealthProfile): SafetyResult {
  const hits: RuleHit[] = [];
  for (const r of RULES) {
    const evidence = r.test(p);
    if (evidence) hits.push({ ruleId: r.id, level: r.level, title: r.title, evidence, action: r.action, source: r.source });
  }
  const level: SafetyLevel = hits.some((h) => h.level === 'red') ? 'red' : hits.length ? 'amber' : 'green';
  return { level, hits, checkedRules: RULES.length, evaluatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ หัตถการเสริม: อบ / ประคบ */

export interface ProcedureGate {
  procedure: 'อบสมุนไพร' | 'ประคบสมุนไพร';
  allowed: boolean;
  reasons: string[];
  source: string;
}

/** ข้อห้ามของหัตถการเสริม แยกจากการนวด (ตำราอ้างอิงฯ หน้า 414–415 · CPG_PCU หน้า 103) */
export function procedureGates(p: HealthProfile): ProcedureGate[] {
  const steam = [
    hasCondition(p, 'โรคหัวใจ') && 'โรคหัวใจ',
    (hasCondition(p, 'ความดันโลหิตสูง') || bpHigh(p, 141, 91)) && 'ความดันโลหิตสูง',
    hasCondition(p, 'โรคลมชัก') && 'โรคลมชัก',
    hasCondition(p, 'โรคไต') && 'โรคไต',
    p.pregnant && 'ตั้งครรภ์',
    p.temperature !== undefined && p.temperature > 37.5 && 'มีไข้',
    hasCondition(p, 'หอบหืด') && 'หอบหืด',
  ].filter(Boolean) as string[];
  const compress = [
    p.injuryWithin48h && 'อักเสบเฉียบพลันใน 24 ชม.แรก',
    p.flags.openWoundOrSkinInfection && 'มีบาดแผล/โรคผิวหนัง',
    p.allergies.some((a) => /สมุนไพร|ไพล|ขมิ้น|การบูร/.test(a)) && 'แพ้สมุนไพร',
  ].filter(Boolean) as string[];
  return [
    { procedure: 'อบสมุนไพร', allowed: steam.length === 0, reasons: steam, source: 'ตำราอ้างอิงฯ หน้า 415, 490' },
    { procedure: 'ประคบสมุนไพร', allowed: compress.length === 0, reasons: compress, source: 'ตำราอ้างอิงฯ หน้า 414 · CPG_PCU หน้า 103' },
  ];
}
