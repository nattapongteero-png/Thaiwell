/**
 * ตัวคัดแยกข้อความในแชท — ทุกข้อความที่ผู้ใช้พิมพ์เอง (ไม่ได้กดตัวเลือก) ผ่านที่นี่ก่อน
 * ------------------------------------------------------------------
 * AI ตีความว่าข้อความ "ทำอะไร" เทียบกับคำถามที่ค้างอยู่ แล้วหน้าแชทเป็นคนตัดสินว่าจะทำต่อยังไง
 *   answer    ตอบคำถามที่ค้าง (อาจบอกข้อมูลข้ออื่นมาด้วย → fields)
 *   question  ถามแทรก → ตอบ แล้วกลับมาถามข้อเดิม
 *   change    ขอแก้คำตอบก่อนหน้า
 *   pause     ขอหยุด / ทำทีหลัง
 *   switch    อยากทำเรื่องอื่น (จอง เลื่อน ยกเลิก หาที่นวด เรื่องใหม่)
 *   complaint ไม่พอใจ / แย่ลงหลังนวด / ร้องเรียน
 *   unclear   กำกวม → ถามกลับพร้อมตัวเลือก (ไม่เดา)
 * danger = AI สงสัยว่าเป็นอาการอันตรายที่กฎจับคำ (EMERGENCY) อาจไม่เจอ → เตือนให้พบแพทย์ (ไม่ใช่ผลคัดกรอง)
 * ❌ ไม่ใช้ตัดสินข้อห้ามนวด — ยังใช้ safetyEngine เหมือนเดิม
 */
import { extractAI } from './aiService';

export type TurnKind = 'answer' | 'question' | 'change' | 'pause' | 'switch' | 'complaint' | 'unclear';
export type SwitchTo = 'booking' | 'cancel' | 'places' | 'assess' | 'other';

/** ข้อมูลการประเมินที่พูดถึงในข้อความ (ไม่ได้พูดถึง = null) */
export interface TurnFields {
  symptoms: string[] | null;
  pain: number | null;
  duration: string | null;
  cause: string | null;
  health: string | null;
  risk: string | null;
  pressure: string | null;
  avoid: string | null;
  radiate: string | null;
  /** ยาที่ใช้ประจำ / สิ่งที่แพ้ (ชื่ออิสระ คั่นด้วย ·) — ดึงจากเรื่องเล่ายาวเท่านั้น */
  meds?: string | null;
  allergy?: string | null;
}
export interface Turn {
  kind: TurnKind;
  danger: boolean;
  switchTo: SwitchTo | null;
  /** เลือกตัวเลือกของคำถามที่ค้างอยู่ (ถ้าตอบตรงตัวเลือก) */
  option: string | null;
  /** คำถาม: เรื่องของผู้ใช้เอง / ความรู้ทั่วไป */
  about: 'personal' | 'knowledge';
  fields: TurnFields;
}
export type TurnEnums = Record<'symptoms' | 'duration' | 'cause' | 'health' | 'risk' | 'pressure' | 'avoid' | 'radiate', string[]>;

export const EMPTY_FIELDS: TurnFields = { symptoms: null, pain: null, duration: null, cause: null, health: null, risk: null, pressure: null, avoid: null, radiate: null };

const QUESTION = /ไหม|มั้ย|หรือเปล่า|รึเปล่า|อะไร|ทำไม|ยังไง|อย่างไร|เท่าไหร่|เท่าไร|กี่|\?/;
const META = /แก้|ผิด|เปลี่ยน|ไม่ใช่|พอก่อน|ไว้ก่อน|ทีหลัง|หยุด|จอง|นัด|ยกเลิก|เลื่อน|แย่|ไม่พอใจ|ร้องเรียน|หมอ|แพทย์/;
/** คำตอบสั้น ๆ ตรงไปตรงมา (ตรงตัวเลือก / ตัวเลข / สั้นและไม่มีคำถามหรือคำสั่ง) → ไม่ต้องคัดแยก ส่งเข้าข้อที่ถามได้เลย */
export const isPlainAnswer = (text: string, options: string[]) => {
  const t = text.trim();
  // ยาวกว่านี้อาจตอบหลายข้อในประโยคเดียว ("ปวด 6 เป็นมา 2 วัน") → ให้ตัวคัดแยกดึงทุกข้อ
  return options.includes(t) || /^\d{1,2}$/.test(t) || (t.length <= 10 && !QUESTION.test(t) && !META.test(t));
};

const nullable = (values: string[]) => ({ type: ['string', 'null'], enum: [...values, null] });

/**
 * pending = คำถามที่ค้างอยู่ (ไม่มี = คุยต่อหลังประเมิน) · options = ตัวเลือกของคำถามนั้น
 * symptomHint = คำพ้องของตำแหน่งที่ปวด (ชุดเดียวกับการแปลงคำตอบข้ออาการ)
 */
export async function classifyTurn(text: string, pending: { label: string; options: string[] } | null, enums: TurnEnums, symptomHint = ''): Promise<Turn> {
  const ask = pending ? `ผู้ช่วยกำลังถามผู้ใช้ว่า: "${pending.label}"${pending.options.length ? ` (ตัวเลือก: ${pending.options.join(', ')})` : ''}` : 'ตอนนี้ไม่มีคำถามค้าง ผู้ใช้คุยต่อเอง';
  const instruction = [
    `${ask} จำแนกข้อความของผู้ใช้`,
    'kind: answer = ตอบคำถามที่ถาม (หรือเล่าอาการ/ข้อมูลเพิ่ม) · question = ถามแทรกหรือสงสัย ไม่ได้ตอบ · change = ขอแก้คำตอบที่ให้ไปก่อนหน้า · pause = ขอหยุด ไว้ก่อน ทำทีหลัง · switch = อยากทำเรื่องอื่น · complaint = ไม่พอใจบริการ หรืออาการแย่ลงหลังนวด · unclear = กำกวม ตีความไม่ได้',
    'switchTo (เฉพาะ switch): booking = จองหรือเลื่อนนัด · cancel = ยกเลิกนัด · places = หาที่นวด · assess = ประเมินอาการเรื่องใหม่ · other',
    'option: ถ้าคำตอบตรงกับตัวเลือกข้อใด ให้ระบุตัวเลือกนั้น ไม่ตรง = null',
    'about: personal = ถามเรื่องของผู้ใช้เอง (นัด ผลการรักษา ประวัติ) · knowledge = ถามความรู้ทั่วไป',
    'danger = true เฉพาะเมื่อเล่าอาการที่อาจอันตราย เช่น แขนขาอ่อนแรง ชาเฉียบพลัน ไข้สูง ปวดรุนแรงเฉียบพลัน ปวดหลังอุบัติเหตุ กลั้นปัสสาวะ/อุจจาระไม่ได้ น้ำหนักลดผิดปกติ',
    `symptoms pain duration cause health risk pressure avoid radiate: ข้อมูลการประเมินทุกข้อที่ผู้ใช้บอกในข้อความนี้ ข้อที่ไม่ได้พูดถึงให้เป็น null ห้ามเดา · ระยะเวลาเลือกที่ใกล้ที่สุด (วันนี้ = เพิ่งเป็นวันนี้เท่านั้น · 2–4 วัน = 2–3 วัน · 1–3 สัปดาห์ = 1 สัปดาห์ · หลายเดือน = เกิน 1 เดือน) · pain = ตัวเลขความปวด 0–10 ที่ผู้ใช้บอกเท่านั้น · ${symptomHint}`,
  ].join('\n');
  // ข้อมูลอาการอยู่ชั้นเดียวกับ kind (ไม่ซ้อน) — โมเดลชอบวนเว้นบรรทัดใน object ซ้อนจนตอบไม่จบ
  const schema = {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['answer', 'question', 'change', 'pause', 'switch', 'complaint', 'unclear'] },
      danger: { type: 'boolean' },
      switchTo: nullable(['booking', 'cancel', 'places', 'assess', 'other']),
      option: pending?.options.length ? nullable(pending.options) : { type: 'null' },
      about: { type: 'string', enum: ['personal', 'knowledge'] },
      // จำกัดจำนวน: โมเดลบางครั้งวนซ้ำรายการไม่จบ
      symptoms: { type: ['array', 'null'], items: { type: 'string', enum: enums.symptoms }, maxItems: 6 },
      pain: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
      duration: nullable(enums.duration),
      cause: nullable(enums.cause),
      health: nullable(enums.health),
      risk: nullable(enums.risk),
      pressure: nullable(enums.pressure),
      avoid: nullable(enums.avoid),
      radiate: nullable(enums.radiate),
    },
    required: ['kind', 'danger', 'switchTo', 'option', 'about', 'symptoms', 'pain', 'duration', 'cause', 'health', 'risk', 'pressure', 'avoid', 'radiate'],
  };
  type Flat = Omit<Turn, 'fields'> & TurnFields;
  const once = () => extractAI<Flat>(`${instruction}\nตอบเป็น JSON บรรทัดเดียว ไม่เว้นบรรทัด`, text, schema, 'turn', 400);
  // ตอบไม่จบ/อ่านไม่ได้ → ลองอีกครั้ง
  const r = await once().catch(once);
  const fields: TurnFields = {
    symptoms: r.symptoms?.length ? [...new Set(r.symptoms)] : null,
    pain: r.pain ?? null,
    duration: r.duration ?? null,
    cause: r.cause ?? null,
    health: r.health ?? null,
    risk: r.risk ?? null,
    pressure: r.pressure ?? null,
    avoid: r.avoid ?? null,
    radiate: r.radiate ?? null,
  };
  return { kind: r.kind, danger: r.danger, switchTo: r.switchTo, option: r.option, about: r.about, fields };
}

/**
 * เล่ายาว (เช่น พูดในโหมดเสียง) → ดึงข้อมูลการประเมินทุกข้อแบบเจาะจง (งานเดียว แม่นกว่าตัวคัดแยกที่ทำหลายอย่างพร้อมกัน)
 * ใช้เติมข้อที่ตัวคัดแยกไม่ได้ดึงมา · related = อาการร่วม (ชา อ่อนแรง …) · hints = คำใบ้ต่อข้อชุดเดียวกับตอนตอบทีละข้อ
 */
export type StoryFields = TurnFields & { related: string[] | null };
export async function extractStory(text: string, enums: TurnEnums & { related: string[] }, symptomHint: string, hints: Record<string, string>): Promise<StoryFields> {
  const instruction = [
    'ผู้ใช้เล่าอาการยาว ๆ ในข้อความเดียว ดึงข้อมูลการประเมินทุกข้อที่ผู้ใช้พูดถึงจริง ข้อที่ไม่ได้พูดถึง = null ห้ามเดา',
    `symptoms = ตำแหน่งที่ปวด · ${symptomHint}`,
    'related = อาการร่วมที่พูดถึง (ไม่ได้พูดถึง = null)',
    'pain = ตัวเลขความปวด 0–10 ที่ผู้ใช้บอกเท่านั้น (พูดเป็นคำ เช่น "เจ็ด" = 7 · "ปวดมาก" ไม่มีตัวเลข = null)',
    `duration = เป็นมานานเท่าไหร่ เลือกที่ใกล้ที่สุด${hints.duration ?? ''}`,
    `cause = สาเหตุ${hints.cause ?? ''}`,
    `risk = ภาวะช่วงนี้ (ผ่าตัด บาดเจ็บ ไข้ ตั้งครรภ์ แผล)${hints.risk ?? ''}`,
    `pressure = น้ำหนักมือที่อยากได้${hints.pressure ?? ''}`,
    'avoid = บริเวณที่ไม่อยากให้นวด',
    `radiate = อาการร้าว${hints.radiate ?? ''}`,
  ].join('\n');
  const schema = {
    type: 'object',
    properties: {
      symptoms: { type: ['array', 'null'], items: { type: 'string', enum: enums.symptoms }, maxItems: 6 },
      related: { type: ['array', 'null'], items: { type: 'string', enum: enums.related }, maxItems: 4 },
      pain: { type: ['integer', 'null'], minimum: 0, maximum: 10 },
      duration: nullable(enums.duration),
      cause: nullable(enums.cause),
      risk: nullable(enums.risk),
      pressure: nullable(enums.pressure),
      avoid: nullable(enums.avoid),
      radiate: nullable(enums.radiate),
    },
    required: ['symptoms', 'related', 'pain', 'duration', 'cause', 'risk', 'pressure', 'avoid', 'radiate'],
  };
  const r = await extractAI<StoryFields>(`${instruction}\nตอบเป็น JSON บรรทัดเดียว ไม่เว้นบรรทัด`, text, schema, 'story', 400);
  return {
    ...EMPTY_FIELDS,
    ...r,
    health: null,
    symptoms: r.symptoms?.length ? [...new Set(r.symptoms)] : null,
    related: r.related?.length ? [...new Set(r.related)] : null,
  };
}
/** มีพูดถึงโรค / ยา / การแพ้ไหม (ไม่มี = ไม่ต้องดึงแยก) */
export const HEALTH_WORDS = /โรค|ยา|แพ้|ความดัน|เบาหวาน|หัวใจ|หอบ|หืด|ไขมัน|กระดูกพรุน|ไทรอยด์|ไต/;
/**
 * โรคประจำตัว / ยาที่กินประจำ / สิ่งที่แพ้ จากเรื่องเล่า — แยกเป็นงานเดียว (รวมกับข้ออื่นแล้วโมเดลรวมข้อความปนกัน)
 * ไม่ได้พูดถึง = null · ปฏิเสธ = "ไม่มี" · ชื่ออิสระ คั่นด้วย ,
 */
export async function extractHealth(text: string): Promise<{ health: string | null; meds: string | null; allergy: string | null }> {
  const r = await extractAI<{ health: string | null; meds: string | null; allergy: string | null }>(
    [
      'ดึงข้อมูลสุขภาพที่ผู้ใช้พูดถึงในข้อความ ข้อที่ไม่ได้พูดถึง = null ห้ามเดา',
      'health = โรคประจำตัว (เช่น ความดันโลหิตสูง, เบาหวาน, โรคหัวใจ, หอบหืด) · "เป็นความดัน" = ความดันโลหิตสูง',
      'meds = ยาที่กินประจำ ใช้ชื่อตามที่พูด (เช่น ยาลดความดัน, ยาเบาหวาน, แอสไพริน) · "กินยาความดัน" = ยาลดความดัน',
      'allergy = สิ่งที่แพ้ ขึ้นต้นด้วย แพ้ (เช่น แพ้กุ้ง, แพ้ยา, แพ้น้ำมันนวด)',
      'หลายอย่างคั่นด้วย , · ผู้ใช้บอกว่าไม่มี/ไม่ได้กิน/ไม่แพ้ = ไม่มี · ใส่แค่ชื่อ ไม่ต้องอธิบาย',
    ].join('\n'),
    text,
    { type: 'object', properties: { health: { type: ['string', 'null'] }, meds: { type: ['string', 'null'] }, allergy: { type: ['string', 'null'] } }, required: ['health', 'meds', 'allergy'] },
    'health',
    200,
  );
  return { health: r.health ?? null, meds: r.meds ?? null, allergy: r.allergy ?? null };
}
/**
 * รวมผลตัวคัดแยกกับผลดึงจากเรื่องเล่า: เล่ายาวใช้ผลดึงเจาะจงทั้งชุด (ตัวคัดแยกชอบเดาข้อที่ไม่ได้พูด เช่น ชาที่มือ → ร้าวลงแขน)
 * ข้อที่ไม่ได้ = ถามตามปกติ · ดึงไม่สำเร็จ = ใช้ของตัวคัดแยก
 */
/**
 * ข้อที่ AI ดึงมาต้องมีคำในข้อความรองรับ — โมเดลชอบเติมข้อที่ผู้ใช้ไม่ได้พูด (เช่น โรคประจำตัว ไม่มี) แล้วแอปเอาไปข้ามคำถามข้อนั้น
 * ไม่มีคำที่เกี่ยวกับข้อนั้นในข้อความ = ตัดทิ้ง (ถามข้อนั้นตามปกติ)
 */
const EVIDENCE: Partial<Record<keyof TurnFields, RegExp>> = {
  pain: /\d|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|เต็ม/,
  duration: /วัน|อาทิตย์|สัปดาห์|เดือน|ปี|เมื่อวาน|เมื่อกี้|ชั่วโมง|นานแล้ว/,
  cause: /นั่ง|ยืน|ยก|แบก|หนัก|ทำงาน|นอน|เครียด|อากาศ|ร้อน|หนาว|เย็น|แอร์|กิน|ข้าว|ออกกำลัง|วิ่ง|ไม่แน่ใจ|ไม่รู้|ไม่ทราบ/,
  health: /โรค|ความดัน|เบาหวาน|หัวใจ|หอบ|หืด|กระดูก|ไขมัน|ไต|แข็งแรง/,
  risk: /ผ่าตัด|บาดเจ็บ|เจ็บมา|ล้ม|อุบัติเหตุ|ไข้|ตัวร้อน|ท้อง|ตั้งครรภ์|แผล|ผื่น|ประจำเดือน|เมนส์|ติดต่อ|โควิด|ไม่มีข้อ|ไม่มีอะไร|ไม่เป็น/,
  pressure: /แรง\s*ๆ|นวดแรง|แรงหน่อย|แรงมาก|นวดเบา|เบา\s*ๆ|เบาหน่อย|เบามือ|หนักมือ|นวดหนัก|น้ำหนักมือ|ลงน้ำหนัก|แรงนวด|ปานกลาง|กลาง\s*ๆ|แล้วแต่/,
  meds: /ยา|กิน|ทาน/,
  allergy: /แพ้/,
  avoid: /ไม่(อยาก|ต้องการ)?ให้นวด|ห้ามนวด|ไม่นวด|เว้น|ทุกที่|ทุกส่วน|ได้หมด/,
  radiate: /ร้าว|แล่น|ลาม|ปวด\S{0,8}ลง(ขา|แขน|ไป|มา)|ที่เดียว/,
};
const NUM: Record<string, number> = { หนึ่ง: 1, เอ็ด: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10 };
/**
 * เป็นมานานเท่าไหร่ อ่านจากคำโดยตรง (AI เลือกผิดบ่อย เช่น สามวัน → 1 สัปดาห์) · อ่านไม่ได้ = null (ใช้ของ AI)
 * วันนี้ = เพิ่งเป็นวันนี้ · 1–4 วัน / เมื่อวาน = 2–3 วัน · 5 วัน–3 สัปดาห์ = 1 สัปดาห์ · 1 เดือนขึ้นไป = เกิน 1 เดือน
 */
export function durationOf(text: string): string | null {
  const t = text.replace(/\s+/g, '');
  if (/หลายเดือน|เป็นปี|หลายปี|ปีที่แล้ว|ปีกว่า|นานมาก|เรื้อรัง/.test(t)) return 'เกิน 1 เดือน';
  const m = t.match(/(\d+|หนึ่ง|เอ็ด|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)?(วัน|อาทิตย์|สัปดาห์|อาทิต|เดือน|ปี)(กว่า)?(แล้ว|มา|ที่แล้ว|ก่อน)?/g);
  for (const hit of m ?? []) {
    const [, n0, unit, more] = hit.match(/(\d+|หนึ่ง|เอ็ด|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)?(วัน|อาทิตย์|สัปดาห์|อาทิต|เดือน|ปี)(กว่า)?/) ?? [];
    if (unit === 'วัน' && !n0) continue; // "วันนี้" "ทุกวัน" ไม่ใช่ระยะเวลา
    const n = n0 ? (NUM[n0] ?? Number(n0)) : 1;
    const days = unit === 'วัน' ? n : /อาทิต|สัปดาห์/.test(unit) ? n * 7 : unit === 'เดือน' ? n * 30 : n * 365;
    if (days >= 30 || (unit === 'เดือน' && more)) return 'เกิน 1 เดือน';
    if (days >= 5) return '1 สัปดาห์';
    if (days >= 1) return '2–3 วัน';
  }
  if (/เมื่อวาน|เมื่อวันก่อน|สองสามวัน|2-3วัน/.test(t)) return '2–3 วัน';
  if (/วันนี้|เมื่อเช้า|เมื่อกี้|เพิ่งเป็น|ตอนเช้า/.test(t)) return 'วันนี้';
  return null;
}
/** สาเหตุ อ่านจากคำโดยตรง (ชุดเดียวกับตัวเลือก) · ไม่ตรง = null (ใช้ของ AI) */
export function causeOf(text: string): string | null {
  if (/นั่ง|หน้าคอม|คอมพิวเตอร์|ขับรถ|ยืนนาน|ยืนทั้งวัน|ก้มหน้า|มือถือ|โทรศัพท์/.test(text)) return 'นั่ง/ยืนนาน';
  if (/ยกของ|ยกลูก|ยกน้ำหนัก|ยกเวท|แบก|หิ้ว|ทำงานหนัก|ออกแรง|ย้ายของ|ย้ายบ้าน|ทำสวน/.test(text)) return 'ยกของหนัก ทำงานหนัก';
  if (/อดนอน|นอนน้อย|นอนไม่พอ|นอนไม่หลับ|นอนดึก/.test(text)) return 'อดนอน';
  if (/เครียด|กังวล/.test(text)) return 'เครียด';
  if (/อากาศ|แอร์|หนาว|ร้อนจัด|ตากแดด|ตากฝน|โดนฝน/.test(text)) return 'อากาศร้อน/เย็น';
  if (/กินไม่ตรง|กินข้าวไม่ตรง|อดข้าว/.test(text)) return 'กินไม่ตรงเวลา';
  return null;
}
/** คะแนนปวด อ่านจากคำโดยตรง ("ปวดหก" "ระดับ 7" "ปวดสักห้า") · "ปวดสองวัน" ไม่ใช่คะแนน · พูดแก้ ("หก ไม่สิ เจ็ด") ใช้ตัวหลัง */
export function painOf(text: string): number | null {
  const re = /(?:ปวด|ระดับ|คะแนน|เจ็บ)\s*(?:ประมาณ|สัก|ราว\s*ๆ?|อยู่ที่|ที่|ซัก)?\s*(\d{1,2}|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)(?!\s*(?:วัน|อาทิตย์|สัปดาห์|เดือน|ปี|ครั้ง|ที่|จุด|ข้าง|ชั่วโมง|นาที|โมง))/g;
  let v: number | null = null;
  for (const m of text.matchAll(re)) {
    const n = NUM[m[1]] ?? Number(m[1]);
    if (n >= 0 && n <= 10) v = n;
  }
  // พูดแก้ท้ายประโยค "ไม่สิ เจ็ด" / "เอ้ย แปด"
  const fix = text.match(/(?:ไม่สิ|ไม่ใช่|เอ้ย|เอ๊ย|แก้เป็น)\s*(\d{1,2}|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ)\s*(?:ค่ะ|ครับ|นะ)?\s*$/);
  if (fix && v !== null) v = NUM[fix[1]] ?? Number(fix[1]);
  return v;
}
/** แรงนวด อ่านจากคำโดยตรง · ไม่ตรง = null */
export function pressureOf(text: string): string | null {
  if (/แล้วแต่(หมอ|ผู้ให้บริการ|คนนวด|ที่ร้าน)?|ให้หมอเลือก|ไม่รู้จะเอาแบบไหน/.test(text)) return 'ให้ผู้ให้บริการเลือก';
  if (/ปานกลาง|กลาง\s*ๆ|พอดี\s*ๆ|ไม่แรงไม่เบา/.test(text)) return 'ปานกลาง';
  if (/เบา\s*ๆ|นวดเบา|เบามือ|เบาหน่อย|ไม่ต้องแรง|อย่าแรง/.test(text)) return 'เบา';
  if (/แรง\s*ๆ|นวดแรง|แรงหน่อย|แรงมาก|หนักมือ|นวดหนัก|หนัก\s*ๆ|ลงน้ำหนัก/.test(text)) return 'หนัก';
  return null;
}
/** นวดได้ทุกส่วน (ไม่มีบริเวณที่ไม่อยากให้นวด) */
const AVOID_NONE = /นวดได้ทุก|ได้หมด(เลย)?|ได้ทุกส่วน|ทุกที่ได้|ไม่มีตรงไหนที่ไม่/;
/** คำที่บอกว่าอาการอาจอันตรายจริง — AI ชอบเตือนเกินเหตุ (เช่น ชานิดหน่อย) แล้วทิ้งสิ่งที่เล่ามาทั้งหมด */
export const DANGER_WORDS = /อ่อนแรง|ยกไม่ขึ้น|เดินไม่ได้|ขยับไม่ได้|กลั้น|ปัสสาวะ|อุจจาระ|ไข้สูง|น้ำหนักลด|อุบัติเหตุ|รถชน|ตกจาก|ล้ม|หกล้ม|เฉียบพลัน|รุนแรงมาก|ปวดมากที่สุด|ทนไม่ไหว|ชาทั้ง|ชาครึ่ง|ชารอบ|มะเร็ง|เลือดออก/;
/** รายการอิสระ (คั่นด้วย , ·) → รูปแบบเดียวกับคำตอบในแชท (คั่นด้วย ·) · ไม่มี = "ไม่มี" */
const listAnswer = (v: string) => {
  // โมเดลบางครั้งเขียนคำอธิบายแทนค่า (เช่น "ไม่มีสิ่งที่แพ้ที่ระบุไว้ (หรือ null …)") → ตัดทิ้ง
  const l = v
    .split(/\s*[·,]\s*|\s+และ\s+|\s+กับ\s+/)
    .map((x) => x.trim())
    .filter((x) => x && x !== 'ไม่มี' && x.length <= 30 && !/null|ระบุ|ข้อความ|ผู้ใช้|\(|\)/i.test(x));
  return l.length ? l.join(' · ') : 'ไม่มี';
};
/** ตัดข้อที่ข้อความไม่ได้พูดถึง + ใช้ค่าที่อ่านจากคำโดยตรง (ระยะเวลา สาเหตุ) แทนที่ AI เลือก */
export const grounded = <T extends Partial<TurnFields>>(f: T, text: string): T => {
  const out = evidenced(f, text) as Partial<TurnFields>;
  if (out.duration != null) out.duration = durationOf(text) ?? out.duration;
  else if (durationOf(text) && /เป็นมา|มา\S*(วัน|อาทิตย์|สัปดาห์|เดือน|ปี)|ตั้งแต่|แล้ว/.test(text)) out.duration = durationOf(text);
  if (out.cause != null && out.cause !== 'ไม่แน่ใจ') out.cause = causeOf(text) ?? out.cause;
  else if (causeOf(text)) out.cause = causeOf(text);
  for (const k of ['health', 'meds', 'allergy'] as const) if (out[k]) out[k] = listAnswer(out[k]!);
  const pn = painOf(text);
  if (pn !== null) out.pain = pn;
  const pr = pressureOf(text);
  if (pr) out.pressure = pr;
  if (AVOID_NONE.test(text)) out.avoid = 'ไม่มี';
  // บอกชัดว่าไม่มีชา/อ่อนแรง → ข้ามข้ออาการร่วม
  const o2 = out as Partial<TurnFields> & { related?: string[] | null };
  if (!o2.related?.length && NO_RELATED.test(text)) o2.related = ['ไม่มี'];
  return out as T;
};
/** คำตอบแบบปฏิเสธ (ไม่มี / ไม่ร้าว) ต้องมีคำปฏิเสธของข้อนั้นจริง — โมเดลชอบเติม "ไม่มี" ให้ข้อที่ไม่ได้พูดถึง */
const DENY: Partial<Record<keyof TurnFields, RegExp>> = {
  risk: /ไม่มีข้อ|ไม่ได้ผ่าตัด|ไม่มีไข้|ไม่ได้ตั้งครรภ์|ไม่ได้ท้อง|ไม่มีแผล|ไม่ได้บาดเจ็บ|ไม่มีอะไรเลย|ไม่มีข้อไหน|ปกติดี|ไม่มีทั้งหมด/,
  radiate: /ไม่ร้าว|ไม่ลาม|ไม่แล่น|ปวดที่เดียว|ปวดแค่ตรงนั้น|ไม่ได้ร้าว/,
  avoid: /นวดได้ทุก|ได้หมด|ไม่มีตรงไหน|ทุกส่วน|ทุกที่/,
  health: /ไม่มีโรค|ไม่ได้เป็นโรค|ไม่เป็นโรค|แข็งแรง|ไม่มีโรคประจำตัว/,
  meds: /ไม่ได้กินยา|ไม่กินยา|ไม่ได้ทานยา|ไม่มียา|ไม่ทานยา|ไม่ได้ใช้ยา/,
  allergy: /ไม่แพ้|ไม่มีแพ้|ไม่มีอาการแพ้/,
  cause: /สาเหตุ|ไม่รู้ว่าเป็นเพราะ|ไม่รู้เพราะ|ไม่แน่ใจว่าเพราะ|ไม่รู้ทำไม|อยู่ดี\s*ๆ/,
};
const NEG_VALUE = /^(ไม่มี|ไม่ร้าว|ไม่แน่ใจ)$/;
/** ผู้ใช้บอกว่าไม่มีอาการร่วม (ชา อ่อนแรง …) */
export const NO_RELATED = /ไม่มีอาการ(ร่วม|อื่น|ชา)|ไม่(มี|ได้)?ชา|ไม่มีอ่อนแรง|ไม่อ่อนแรง/;
/** ไม่แน่ใจ / ไม่รู้ (ตอบข้อที่ถาม) */
export const UNSURE = /ไม่แน่ใจ|ไม่รู้|ไม่ทราบ|บอกไม่ถูก|จำไม่ได้|ไม่ค่อยแน่ใจ/;
/** ไม่เข้าใจคำถาม / ขอให้ถามใหม่ */
export const REPEAT_ASK = /หมายความว่า|หมายถึง(อะไร)?|ไม่เข้าใจ|ยังไงนะ|อะไรนะ|พูดอีกที|ถามอีกที|ทวนอีกที|ถามว่าอะไร|ว่าไงนะ|ขออีกที/;
export const evidenced = <T extends Partial<TurnFields>>(f: T, text: string): T => {
  const out = { ...f };
  (Object.keys(DENY) as (keyof TurnFields)[]).forEach((k) => {
    const v = (out as Record<string, unknown>)[k];
    if (typeof v === 'string' && NEG_VALUE.test(v.trim()) && !DENY[k]!.test(text)) (out as Record<string, unknown>)[k] = null;
  });
  (Object.keys(EVIDENCE) as (keyof TurnFields)[]).forEach((k) => {
    if (k in out && (out as Record<string, unknown>)[k] != null && !EVIDENCE[k]!.test(text)) (out as Record<string, unknown>)[k] = null;
  });
  return out;
};
export const mergeFields = (a: TurnFields, b: StoryFields | null): TurnFields & { related?: string[] | null } => (b ? { ...b, symptoms: b.symptoms ?? a.symptoms } : a);
