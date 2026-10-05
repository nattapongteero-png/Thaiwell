/**
 * AI Service — LLM สำหรับแชท (Gemma 4 31B ผ่าน vLLM · OpenAI-compatible)
 * ------------------------------------------------------------------
 * ใช้ทำ 3 อย่าง: เข้าใจข้อความอิสระ → ข้อมูลมีโครง (JSON schema) · ตอบคำถามจากข้อมูลการรักษาของคนไข้ · สรุปเป็นภาษาง่าย
 * ❌ ไม่ใช้ตัดสินเรื่องความปลอดภัย/ข้อห้ามนวด — ใช้ safetyEngine (กฎตายตัว) เท่านั้น
 *
 * ⚠️ ต้นแบบ: แอปเรียก endpoint ตรง (ยังไม่มี key) — ใช้ได้กับข้อมูลตัวอย่างเท่านั้น
 *    ของจริงต้องผ่าน backend ของเรา (เก็บ key · ตัดข้อมูลระบุตัวตน · log) → เปลี่ยนที่ AI_BASE_URL ที่เดียว
 */
export const AI_BASE_URL = 'https://vllm-gemma.bmscloud.in.th/v1';
export const AI_MODEL = 'gemma4';

export type AIMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_BASE = [
  'คุณคือผู้ช่วย ThaiWell สำหรับคลินิกนวดแผนไทย ตอบภาษาไทยสุภาพ ลงท้าย "ค่ะ" สั้น กระชับ ไม่เกิน 2–3 ประโยค',
  'ห้ามวินิจฉัยโรค ห้ามสั่งยา ห้ามตัดสินว่านวดได้หรือไม่ (ระบบคัดกรองเป็นคนตัดสิน)',
  'ถ้าผู้ใช้เล่าอาการอันตราย (ชา อ่อนแรงเฉียบพลัน เจ็บหน้าอก หายใจลำบาก ไข้สูง) ให้แนะนำพบแพทย์ทันที',
  'ใช้เฉพาะข้อมูลที่ให้มา ถ้าไม่รู้ให้บอกว่าไม่ทราบ อย่าแต่งตัวเลขหรือวันที่ขึ้นเอง',
].join('\n');

async function call(body: object, timeoutMs = 30000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, temperature: 0.3, max_tokens: 300, ...body }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const j = await res.json();
    return (j.choices?.[0]?.message?.content ?? '').trim();
  } finally {
    clearTimeout(t);
  }
}

/** เรียกโมเดลตรง (ใช้โดย knowledgeSearch) */
export const completeAI = (messages: AIMessage[], opts: { max_tokens?: number; temperature?: number; response_format?: object } = {}, timeoutMs?: number) =>
  call({ messages, ...opts }, timeoutMs);

/** ตอบคำถามอิสระ โดยใช้ข้อมูลของคนไข้เป็นบริบท */
export async function askAI(question: string, context: string, history: AIMessage[] = []): Promise<string> {
  return call({
    messages: [{ role: 'system', content: `${SYSTEM_BASE}\n\nข้อมูลของผู้ใช้:\n${context}` }, ...history.slice(-6), { role: 'user', content: question }],
  });
}

/** แปลงข้อความอิสระเป็นข้อมูลตาม JSON schema (temperature 0) */
export async function extractAI<T>(instruction: string, text: string, schema: object, name = 'result'): Promise<T> {
  const out = await call({
    temperature: 0,
    max_tokens: 200,
    messages: [
      { role: 'system', content: instruction },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_schema', json_schema: { name, schema } },
  });
  return JSON.parse(out) as T;
}
