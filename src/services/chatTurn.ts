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
    `health = โรคประจำตัว${hints.health ?? ''}`,
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
      health: nullable(enums.health),
      risk: nullable(enums.risk),
      pressure: nullable(enums.pressure),
      avoid: nullable(enums.avoid),
      radiate: nullable(enums.radiate),
    },
    required: ['symptoms', 'related', 'pain', 'duration', 'cause', 'health', 'risk', 'pressure', 'avoid', 'radiate'],
  };
  const r = await extractAI<StoryFields>(`${instruction}\nตอบเป็น JSON บรรทัดเดียว ไม่เว้นบรรทัด`, text, schema, 'story', 400);
  return {
    ...EMPTY_FIELDS,
    ...r,
    symptoms: r.symptoms?.length ? [...new Set(r.symptoms)] : null,
    related: r.related?.length ? [...new Set(r.related)] : null,
  };
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
  pressure: /แรง|เบา|หนัก|กลาง|มือ/,
  avoid: /ไม่(อยาก|ต้องการ)?ให้นวด|ห้ามนวด|ไม่นวด|เว้น|ทุกที่|ทุกส่วน|ได้หมด/,
  radiate: /ร้าว|แล่น|ลาม|ลงไป|ลงขา|ลงแขน|ชา|อ่อนแรง|ที่เดียว/,
};
export const evidenced = <T extends Partial<TurnFields>>(f: T, text: string): T => {
  const out = { ...f };
  (Object.keys(EVIDENCE) as (keyof TurnFields)[]).forEach((k) => {
    if (k in out && (out as Record<string, unknown>)[k] != null && !EVIDENCE[k]!.test(text)) (out as Record<string, unknown>)[k] = null;
  });
  return out;
};
export const mergeFields = (a: TurnFields, b: StoryFields | null): TurnFields & { related?: string[] | null } => (b ? { ...b, symptoms: b.symptoms ?? a.symptoms } : a);
