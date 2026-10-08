/**
 * คุยด้วยเสียงกับ AI (BMS Cloud · OpenAI-compatible — ชุดเดียวกับ bms-hosxp-plus lib/er/er_shared/er_ai.dart)
 *   ถอดเสียง  asr2 (Qwen3-ASR)   POST /v1/audio/transcriptions
 *   พูด       vox-cpm             POST /v1/audio/speech
 * ❌ ไม่ใช้ตัดสินความปลอดภัย — คำที่พูดส่งเข้าแชทประเมินเดิมเหมือนพิมพ์ (กฎคัดกรองเดิมตัดสิน)
 * ⚠️ ต้นแบบ: endpoint ยังไม่มี key → ไม่ส่งชื่อ/เลขบัตร ส่งแค่เสียงและสิ่งที่ผู้ใช้เล่า
 */
import { File, Paths } from 'expo-file-system';

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
