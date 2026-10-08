/**
 * คุยด้วยเสียงกับ AI (BMS Cloud · OpenAI-compatible — ชุดเดียวกับ bms-hosxp-plus lib/er/er_shared/er_ai.dart)
 *   ถอดเสียง  asr2 (Qwen3-ASR)   POST /v1/audio/transcriptions
 *   พูด       vox-cpm             POST /v1/audio/speech
 * ❌ ไม่ใช้ตัดสินความปลอดภัย — คำที่พูดส่งเข้าแชทประเมินเดิมเหมือนพิมพ์ (กฎคัดกรองเดิมตัดสิน)
 * ⚠️ ต้นแบบ: endpoint ยังไม่มี key → ไม่ส่งชื่อ/เลขบัตร ส่งแค่เสียงและสิ่งที่ผู้ใช้เล่า
 */
import { File, Paths } from 'expo-file-system';
import { extractAI } from './aiService';

const ASR_BASE = 'https://asr2.bmscloud.in.th/v1';
const TTS_BASE = 'https://vox-cpm.bmscloud.in.th/v1';

/** Qwen3-ASR ชอบแปะแท็กภาษา (เช่น "language Thai<asr_text>") และเดาเป็นอักษรจีน/ญี่ปุ่นตอนเสียงไม่ชัด → ตัดทิ้ง */
export function cleanTranscript(text: string) {
  const langs = '(?:thai|english|chinese|mandarin|cantonese|yue|japanese|korean|vietnamese|burmese|lao|malay)';
  return text
    .replace(/<\|?\/?[A-Za-z_-]{1,24}\|?>/g, '')
    .replace(new RegExp(`(?:^|\\s)language\\s*[:：-]?\\s*${langs}\\b`, 'gi'), ' ')
    .replace(new RegExp(`^\\s*${langs}\\s*[:：-]?\\s+`, 'i'), '')
    .replace(/[　-ヿ㐀-鿿가-힯＀-￯]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await run(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** ไฟล์เสียง (WAV 16 kHz mono) → ข้อความ */
/** บริบทของบทสนทนาตอนพูด → ให้ถอดเสียงเอนไปทางคำในเรื่องที่คุยอยู่ + ตรวจว่าที่ได้ยินเข้ากับเรื่องไหม */
export interface HeardContext {
  /** คำถาม/ข้อความล่าสุดของผู้ช่วย */
  question?: string;
  /** ตัวเลือกที่ตอบได้ตอนนี้ */
  options?: string[];
  /** ที่ผู้ใช้พูดก่อนหน้า (ล่าสุดท้าย) */
  recent?: string[];
}
const ASR_BASE_PROMPT = 'ผู้ใช้คุยกับผู้ช่วยประเมินอาการปวดเมื่อยเพื่อนวดแผนไทยเป็นภาษาไทย คำที่พบบ่อย: ปวดคอ บ่า ไหล่ หลัง เอว สะโพก เข่า ร้าว ชา อ่อนแรง นวด ประคบ จองนัด ยืนยัน แก้ไข';

export async function transcribe(uri: string, ctx?: HeardContext): Promise<string> {
  const form = new FormData();
  form.append('file', { uri, name: 'clip.wav', type: 'audio/wav' } as unknown as Blob);
  form.append('model', 'Qwen/Qwen3-ASR-1.7B');
  // บริบทให้เอนไปทางภาษาไทยเรื่องอาการปวด ลดการเดาเป็นภาษาอื่น
  // คำถามล่าสุด + ตัวเลือก → คำที่ผู้ใช้น่าจะพูด ถอดได้ตรงขึ้น (สั้น ๆ ไม่ให้ยาวจนโมเดลลอกตาม)
  const extra = [ctx?.question, ctx?.options?.length ? `ตัวเลือก: ${ctx.options.slice(0, 12).join(' ')}` : ''].filter(Boolean).join(' · ');
  form.append('prompt', `${ASR_BASE_PROMPT}${extra ? ` · ${extra.slice(0, 240)}` : ''}`);
  form.append('response_format', 'json');
  const res = await withTimeout(60000, (signal) => fetch(`${ASR_BASE}/audio/transcriptions`, { method: 'POST', body: form, signal }));
  if (!res.ok) throw new Error(`asr ${res.status}`);
  const j = (await res.json()) as { text?: string };
  return cleanTranscript(j.text ?? '');
}

/**
 * ตรวจคำที่ถอดได้กับบทสนทนา: แก้คำที่ถอดเพี้ยน (เสียงใกล้กัน) ให้ตรงเรื่องที่คุยอยู่ · ฟังไม่ได้ความ/ไม่เกี่ยวเลย = clear false
 * ห้ามเติมเนื้อหาที่ไม่ได้พูด · ติดต่อไม่ได้/ช้า = ใช้ข้อความเดิม
 */
export async function understandHeard(raw: string, ctx?: HeardContext): Promise<{ text: string; clear: boolean }> {
  const lines = [
    'ข้อความด้านล่างได้จากการถอดเสียงพูดภาษาไทยอัตโนมัติ อาจถอดผิด (คำพ้องเสียง สะกดเพี้ยน วรรณยุกต์ผิด คำขาดหาย ตัวเลขเป็นคำ)',
    'ผู้ใช้คุยกับผู้ช่วยประเมินอาการปวดเมื่อยเพื่อนวดแผนไทย (อาการ ตำแหน่งที่ปวด ระดับปวด 0–10 โรคประจำตัว ยา การแพ้ ข้อห้ามนวด แรงนวด จองนัด เช็กอิน คิว บิล ผลการรักษา แก้ไข/ยืนยันข้อมูล)',
    ctx?.question ? `ผู้ช่วยเพิ่งถาม/พูดว่า: ${ctx.question.slice(0, 300)}` : '',
    ctx?.options?.length ? `ตัวเลือกที่ตอบได้ตอนนี้: ${ctx.options.slice(0, 30).join(', ')}` : '',
    ctx?.recent?.length ? `ผู้ใช้พูดก่อนหน้า: ${ctx.recent.slice(-3).join(' | ').slice(0, 300)}` : '',
    'text = สิ่งที่ผู้ใช้น่าจะพูดจริง: แก้เฉพาะคำที่ถอดเพี้ยนให้เป็นคำที่เสียงใกล้เคียงและเข้ากับบทสนทนา (เช่น ตรงกับตัวเลือก) · คงความหมายและลำดับเดิม ห้ามเติมเนื้อหาที่ไม่ได้พูด ห้ามตอบแทนผู้ใช้ · ตัวเลขที่พูดเป็นคำให้เป็นตัวเลข',
    // ถามเป็น nonsense (ไม่ใช่ clear) — ทดสอบแล้วโมเดลตอบ clear กลับด้านเกือบทุกประโยค
    'nonsense = true เฉพาะเมื่ออ่านแล้วไม่ได้ความหมายเลย หรือเป็นภาษาอื่น/เสียงรบกวน/คำสุ่ม · ประโยคที่อ่านเข้าใจได้ทุกแบบ (ตอบคำถาม เล่าอาการ ถามเรื่องอื่น ขอจอง ฯลฯ) = false',
  ].filter(Boolean);
  try {
    const r = await Promise.race([
      extractAI<{ text: string; nonsense: boolean }>(lines.join('\n'), raw, { type: 'object', properties: { text: { type: 'string' }, nonsense: { type: 'boolean' } }, required: ['text', 'nonsense'] }, 'heard', 300),
      new Promise<null>((ok) => setTimeout(() => ok(null), 8000)),
    ]);
    if (!r || typeof r.text !== 'string') return { text: raw, clear: true };
    const text = r.text.trim();
    // แก้จนยาวผิดปกติ = เติมเอง → ใช้ของเดิม
    return { text: text && text.length <= raw.length * 2 + 20 ? text : raw, clear: r.nonsense !== true };
  } catch {
    return { text: raw, clear: true };
  }
}

/** ข้อความ → ไฟล์เสียง MP3 ในแคช (คืน uri ไว้เล่น) */
export async function speak(text: string): Promise<string> {
  const res = await withTimeout(60000, (signal) =>
    fetch(`${TTS_BASE}/audio/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text, voice: 'female', response_format: 'mp3' }), signal }),
  );
  if (!res.ok) throw new Error(`tts ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const f = new File(Paths.cache, `tts-${Date.now()}.mp3`);
  f.write(buf);
  return f.uri;
}
