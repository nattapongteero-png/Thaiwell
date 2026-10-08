/**
 * คุยด้วยเสียงกับ AI (BMS Cloud · OpenAI-compatible — ชุดเดียวกับ bms-hosxp-plus lib/er/er_shared/er_ai.dart)
 *   ถอดเสียง  asr2 (Qwen3-ASR)   POST /v1/audio/transcriptions
 *   พูด       vox-cpm             POST /v1/audio/speech
 *   คุย/สรุป  vllm-gemma (เดิม)   ผ่าน completeAI
 * ❌ ไม่ใช้ตัดสินความปลอดภัย — สรุปเป็นข้อความแล้วส่งเข้าแชทประเมินเดิม (กฎคัดกรองเดิมตัดสิน)
 * ⚠️ ต้นแบบ: endpoint ยังไม่มี key → ไม่ส่งชื่อ/เลขบัตร ส่งแค่เสียงและสิ่งที่ผู้ใช้เล่า
 */
import { File, Paths } from 'expo-file-system';
import { completeAI, type AIMessage } from './aiService';

const ASR_BASE = 'https://asr2.bmscloud.in.th/v1';
const TTS_BASE = 'https://vox-cpm.bmscloud.in.th/v1';

export type VoiceTurn = { from: 'ai' | 'user'; text: string };

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
export async function transcribe(uri: string): Promise<string> {
  const form = new FormData();
  form.append('file', { uri, name: 'clip.wav', type: 'audio/wav' } as unknown as Blob);
  form.append('model', 'Qwen/Qwen3-ASR-1.7B');
  // บริบทให้เอนไปทางภาษาไทยเรื่องอาการปวด ลดการเดาเป็นภาษาอื่น
  form.append('prompt', 'ผู้ใช้เล่าอาการปวดเมื่อยเป็นภาษาไทย เพื่อรับการนวดแผนไทย');
  form.append('response_format', 'json');
  const res = await withTimeout(60000, (signal) => fetch(`${ASR_BASE}/audio/transcriptions`, { method: 'POST', body: form, signal }));
  if (!res.ok) throw new Error(`asr ${res.status}`);
  const j = (await res.json()) as { text?: string };
  return cleanTranscript(j.text ?? '');
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

const FRIEND = [
  'คุณคือเพื่อนผู้หญิงใจดีชื่อ "ไทยเวล" กำลังคุยด้วยเสียงกับผู้ใช้ที่อยากระบายเรื่องอาการปวดเมื่อยหรือความเหนื่อยล้า',
  'พูดภาษาไทยเป็นกันเอง อบอุ่น ลงท้าย "ค่ะ/นะคะ" ตอบสั้นมาก 1–2 ประโยค (จะถูกอ่านออกเสียง) ไม่ใช้อีโมจิ ไม่ใช้เครื่องหมายพิเศษ',
  'รับฟังและเห็นใจก่อน แล้วถามต่อทีละเรื่องเดียว ให้ได้ข้อมูลเหล่านี้แบบเป็นธรรมชาติ: ปวดตรงไหน · ปวดมากแค่ไหน 0–10 · เป็นมานานเท่าไหร่ · น่าจะเกิดจากอะไร (ท่าทาง งาน การนอน ความเครียด) · มีอาการอื่นร่วมไหม',
  'ห้ามวินิจฉัยโรค ห้ามแนะนำยา ห้ามบอกว่านวดได้หรือไม่ได้',
  'ถ้าได้ข้อมูลครบแล้ว หรือคุยไปแล้วหลายรอบ ให้บอกว่า "ถ้าพร้อมแล้ว กดสรุปให้หน่อย ได้เลยนะคะ"',
].join('\n');

const toMessages = (turns: VoiceTurn[]): AIMessage[] => turns.map((t) => ({ role: t.from === 'ai' ? 'assistant' : 'user', content: t.text }));

/** ตอบกลับแบบเพื่อนคุย (สั้น อ่านออกเสียงได้) */
export async function friendReply(turns: VoiceTurn[]): Promise<string> {
  const out = await completeAI([{ role: 'system', content: FRIEND }, ...toMessages(turns.slice(-12))], { max_tokens: 120, temperature: 0.6 }, 30000);
  return out.replace(/[*#_`>]/g, '').trim();
}

/** สรุปสิ่งที่ผู้ใช้เล่า → ข้อความเดียว (ส่งเข้าแชทประเมินเดิม ให้ระบบดึงอาการ/คะแนน/ระยะเวลา แล้วถามข้อที่ยังขาด) */
export async function summarizeTalk(turns: VoiceTurn[]): Promise<string> {
  const said = turns
    .filter((t) => t.from === 'user')
    .map((t) => t.text)
    .join('\n');
  const out = await completeAI(
    [
      {
        role: 'system',
        content:
          'สรุปสิ่งที่ผู้ใช้เล่าเป็นข้อความภาษาไทยมุมมองผู้ใช้ (ขึ้นต้นแบบ "ปวด…") 1–3 ประโยค เฉพาะข้อเท็จจริงที่ผู้ใช้พูดจริง: ตำแหน่งที่ปวด (ซ้าย/ขวาถ้าบอก) ระดับปวด 0–10 ระยะเวลา สาเหตุ อาการร่วม โรคประจำตัว · ห้ามเติมสิ่งที่ไม่ได้พูด ห้ามวินิจฉัย ไม่มีหัวข้อ ไม่มีบูลเล็ต',
      },
      { role: 'user', content: said },
    ],
    { max_tokens: 200, temperature: 0 },
    30000,
  );
  return out.replace(/[*#_`>]/g, '').trim();
}
