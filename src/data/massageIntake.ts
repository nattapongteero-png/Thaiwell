/**
 * ข้อมูลแรกรับสำหรับวางแผนการนวด — รายการที่ AI ต้องมีก่อนคำนวณแผน
 * ------------------------------------------------------------------
 * แต่ละข้อบอกว่าได้มาจากไหน จะได้ไม่ถามซ้ำ:
 *   account = จาก Health ID / สมัคร · chat = ถามในแชทประเมิน · history = ประวัติการรักษาในแอป · clinic = วัดที่คลินิกก่อนนวด
 * ความปลอดภัยยังตัดสินด้วย safetyEngine (ส่งผลให้ AI เป็นข้อมูล ไม่ให้ AI ตัดสินเอง)
 */
import type { Assessment } from './homeFeed';

export type IntakeSource = 'account' | 'chat' | 'history' | 'clinic';

export interface IntakeContext {
  age?: number;
  sex?: string;
  occupation?: string;
  assess: Assessment;
  symptoms: string[];
  related: string[];
  conditions: string[];
  medications: string[];
  allergies: string[];
  bp?: { sys: number; dia: number };
  pulse?: number;
  /** สรุปการรักษาที่ผ่านมา (ถ้ามี) */
  history?: string;
  /** ผลคัดกรองจาก safetyEngine */
  safety: { level: 'green' | 'amber' | 'red'; items: string[] };
}

const none = (v: string[]) => (v.length ? v.join(', ') : 'ไม่มี');

/** หมวดข้อมูล → วิธีได้มา → ค่า */
export const INTAKE_FIELDS: { label: string; from: IntakeSource; value: (c: IntakeContext) => string }[] = [
  { label: 'ข้อมูลทั่วไป', from: 'account', value: (c) => [c.age ? `อายุ ${c.age} ปี` : '', c.sex ? `เพศ${c.sex}` : ''].filter(Boolean).join(', ') || 'ไม่ระบุ' },
  { label: 'วัตถุประสงค์การนวด', from: 'chat', value: (c) => (c.assess.pain > 0 || c.symptoms.length ? 'ลดอาการปวด' : 'ผ่อนคลาย') },
  { label: 'อาการหลัก / ตำแหน่ง', from: 'chat', value: (c) => none(c.symptoms) },
  { label: 'อาการร้าว', from: 'chat', value: (c) => c.assess.radiate ?? 'ไม่ได้ถาม' },
  { label: 'ระดับความปวด', from: 'chat', value: (c) => `${c.assess.pain}/10` },
  { label: 'ระยะเวลาที่มีอาการ', from: 'chat', value: (c) => c.assess.duration ?? 'ไม่ระบุ' },
  { label: 'สาเหตุ / ลักษณะงาน', from: 'chat', value: (c) => [c.assess.cause, c.occupation].filter((x) => x && x !== 'ไม่แน่ใจ').join(', ') || 'ไม่ทราบ' },
  { label: 'อาการร่วม (ชา อ่อนแรง ฯลฯ)', from: 'chat', value: (c) => none(c.related.filter((r) => r !== 'ไม่มี')) },
  { label: 'โรคประจำตัว', from: 'chat', value: (c) => none(c.conditions) },
  { label: 'ยาที่ใช้อยู่', from: 'chat', value: (c) => none(c.medications) },
  { label: 'ยาที่เพิ่มความเสี่ยงเลือดออก', from: 'chat', value: (c) => (c.medications.some((m) => m.includes('ลิ่มเลือด')) ? 'มี' : 'ไม่มี') },
  { label: 'ผ่าตัด บาดเจ็บ ไข้ ตั้งครรภ์ แผล', from: 'chat', value: (c) => c.assess.risk ?? 'ไม่ได้ถาม' },
  { label: 'การแพ้', from: 'account', value: (c) => none(c.allergies) },
  { label: 'ความดัน / ชีพจร', from: 'clinic', value: (c) => (c.bp ? `${c.bp.sys}/${c.bp.dia} mmHg${c.pulse ? `, ชีพจร ${c.pulse}` : ''}` : 'วัดที่คลินิกก่อนนวด') },
  { label: 'แรงนวดที่ต้องการ', from: 'chat', value: (c) => c.assess.pressure ?? 'ไม่ระบุ' },
  { label: 'ประวัติการนวด', from: 'history', value: (c) => c.history || 'ยังไม่เคยรักษากับเรา' },
  {
    label: 'ผลคัดกรองความปลอดภัย',
    from: 'chat',
    value: (c) => `${c.safety.level === 'green' ? 'ไม่พบข้อห้าม' : c.safety.level === 'red' ? 'พบข้อห้าม' : 'มีข้อควรระวัง'}${c.safety.items.length ? `: ${c.safety.items.join(', ')}` : ''}`,
  },
];

export const buildIntake = (c: IntakeContext): [string, string][] => INTAKE_FIELDS.map((f) => [f.label, f.value(c)]);
