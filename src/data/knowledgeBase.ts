/**
 * KNOWLEDGE BASE — แผนการดูแลที่ AI แนะนำ (RAG) อ้างอิงเอกสารจริงใน knowledge hub/E-book
 * การจับคู่เส้น/จุดสัญญาณกับกลุ่มอาการเป็นการออกแบบของเรา (เอกสารไม่ระบุสูตรเฉพาะกลุ่มอาการ)
 * ⚠️ ต้องให้แพทย์แผนไทยผู้รับผิดชอบทบทวนก่อนใช้งานจริง
 */
import type { SourceRef, TraceStep } from '../design-system/components/AI';

export interface CareSuggestion {
  id: string;
  title: string;
  summary: string;
  duration: number; // นาที
  match: 1 | 2 | 3 | 4 | 5;
  focusAreas: string[];
  adjustments: string[]; // ปรับตามข้อควรระวังจาก Safety Engine
  sources: SourceRef[];
  trace: TraceStep[];
}

/** แหล่งอ้างอิงจริงใน knowledge hub/E-book (เลขหน้า = PDF page) */
export const SOURCES: Record<string, SourceRef> = {
  cpgPain: { id: 'CPG-PCU', title: 'แนวทางเวชปฏิบัติ: อาการปวดกล้ามเนื้อเรื้อรัง — การรักษาด้วยการนวด อบ ประคบ', publisher: 'CPG_PCU.pdf', section: 'หน้า 133, 150–157' },
  cpgHtn: { id: 'CPG-PCU', title: 'ข้อควรระวังการนวดในผู้มีความดันโลหิตสูง', publisher: 'CPG_PCU.pdf', section: 'หน้า 62–63' },
  refRoyal: { id: 'REF-4', title: 'การนวดไทยแบบราชสำนัก: เส้นพื้นฐานและจุดสัญญาณ', publisher: 'ตำราอ้างอิงด้านการแพทย์แผนไทย.pdf', section: 'หน้า 369, 400–410' },
  refContra: { id: 'REF-4', title: 'ข้อห้ามและข้อควรระวังในการนวดไทย', publisher: 'ตำราอ้างอิงด้านการแพทย์แผนไทย.pdf', section: 'หน้า 391, 401–402' },
  refHerb: { id: 'REF-4', title: 'การประคบและการอบสมุนไพร', publisher: 'ตำราอ้างอิงด้านการแพทย์แผนไทย.pdf', section: 'หน้า 413–415' },
  yd: { id: 'YD-7', title: 'นวดไทย ยืดเหยียด 7 กลุ่มอาการ: ปวดคอ บ่า ไหล่', publisher: 'ยืดเหยียด 7 กลุ่มอาการ.pdf', section: 'หน้า 3' },
};

export const CARE_SUGGESTIONS: CareSuggestion[] = [
  {
    id: 'plan-a',
    title: 'นวดไทยแบบราชสำนัก สูตรกลาง เน้นบ่า–โค้งคอ',
    summary:
      'นวดเส้นพื้นฐานบ่าและพื้นฐานโค้งคอ กดจุดสัญญาณหัวไหล่ 1–5 และสัญญาณศีรษะด้านหลัง ใช้นิ้วหัวแม่มือ ท่านั่งหรือนอนตะแคง (ไม่นอนคว่ำ) กดแบบคาบน้อย 10–15 วินาที',
    duration: 60,
    match: 4,
    focusAreas: ['คอ', 'บ่า/ไหล่ขวา', 'หลังส่วนบน'],
    adjustments: ['กดนวดด้วยความระมัดระวัง ไม่นวดแรงเกินไป (CA-01 · CPG หน้า 62)', 'เปิดประตูลมไม่เกิน 30–45 วินาที (ตำราฯ หน้า 400, 403)'],
    sources: [SOURCES.refRoyal, SOURCES.cpgPain, SOURCES.cpgHtn],
    trace: [
      { kind: 'input', text: 'อาการหลัก: ปวดตึงคอ–บ่าขวา สัมพันธ์กับการใช้คอมพิวเตอร์ → กลุ่มอาการ Office syndrome (ยืดเหยียด 7 กลุ่มอาการ หน้า 3)' },
      { kind: 'retrieval', text: 'CPG ปวดกล้ามเนื้อเรื้อรัง: นวดราชสำนัก “สูตรกลาง” ตามดุลยพินิจผู้ประกอบวิชาชีพ (CPG หน้า 150–151)' },
      { kind: 'retrieval', text: 'รหัสโรคแผนไทยที่อาจเกี่ยวข้อง: U57.30 ลมปลายปัตฆาตโค้งคอ, U57.20 ลมปลายปัตฆาตบ่า (CPG หน้า 143–150)' },
      { kind: 'retrieval', text: 'ตำแหน่งเส้นพื้นฐานบ่า/โค้งคอ และจุดสัญญาณหัวไหล่ 1–5 (ตำราฯ หน้า 401, 409–410)' },
      { kind: 'rule', text: 'Safety Engine: CA-01 ความดันโลหิตสูง → ลดแรงกด งดอบสมุนไพร' },
      { kind: 'input', text: 'ประวัติครั้งก่อน: โปรแกรมเดียวกันลดปวดได้ 3 คะแนน' },
    ],
  },
  {
    id: 'plan-b',
    title: 'นวด + ประคบสมุนไพร (งดอบ)',
    summary: 'ขั้นตอนตาม CPG คือ อบ → นวด → ประคบ แต่ผู้รับบริการมีความดันสูงจึงงดอบ ใช้ลูกประคบ (ไพลเป็นหลัก) 15–30 นาทีหลังนวด',
    duration: 60,
    match: 3,
    focusAreas: ['บ่า/ไหล่ขวา', 'หลังส่วนบน'],
    adjustments: ['งดอบสมุนไพร: ความดันโลหิตสูง (ตำราฯ หน้า 415)', 'ทดสอบความร้อนลูกประคบที่ท้องแขนก่อน (ตำราฯ หน้า 414)'],
    sources: [SOURCES.cpgPain, SOURCES.refHerb],
    trace: [
      { kind: 'retrieval', text: 'CPG: อบ ~30 นาที → นวด → ประคบ 15–30 นาที (CPG หน้า 133, 151)' },
      { kind: 'rule', text: 'ข้อห้ามอบสมุนไพร: ความดันโลหิตสูง → ตัดขั้นอบออก' },
      { kind: 'retrieval', text: 'ลูกประคบ: ไพล ขมิ้นชัน มะกรูด ตะไคร้ ใบมะขาม เกลือ การบูร (ตำราฯ หน้า 413–414)' },
    ],
  },
  {
    id: 'plan-c',
    title: 'นวดเพื่อผ่อนคลายทั้งตัว (บริการเวลเนส)',
    summary: 'ส่งเสริมสุขภาพ กล้ามเนื้อผ่อนคลาย เหมาะกับเป้าหมายด้านความเครียดและการนอน ไม่ใช่การบำบัดอาการเฉพาะจุด',
    duration: 90,
    match: 2,
    focusAreas: ['ทั้งตัว'],
    adjustments: ['แรงกดเบาทั้งหมด (CA-01)'],
    sources: [SOURCES.refContra],
    trace: [
      { kind: 'input', text: 'ความเครียด 4/5 · การนอน 2/5' },
      { kind: 'retrieval', text: 'นวดเพื่อผ่อนคลาย = บริการเวลเนสตาม พ.ร.บ. สถานประกอบการเพื่อสุขภาพ 2559 (KH_นวดไทย หน้า 1, 5)' },
    ],
  },
];

export const TECHNIQUES = ['กดจุด', 'คลึง', 'บีบ', 'ยืด/ดัด', 'ประคบสมุนไพร', 'ลูบ'];
export const PRESSURE = ['เบา', 'ปานกลาง', 'หนัก'];
