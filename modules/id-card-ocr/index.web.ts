/**
 * เว็บ: อ่านข้อความในรูปบัตรในเบราว์เซอร์เอง (Tesseract.js · ภาษาไทย+อังกฤษ) — รูปไม่ถูกส่งออกไปไหน
 * ครั้งแรกดาวน์โหลดตัวอ่าน + ข้อมูลภาษาจาก CDN (ไม่มีข้อมูลผู้ใช้ไปด้วย) แล้วใช้ซ้ำ
 */
import type { Worker } from 'tesseract.js';

export const ocrAvailable = true;

let worker: Promise<Worker> | null = null;
const getWorker = () =>
  (worker ??= import('tesseract.js').then(({ createWorker }) => createWorker(['tha', 'eng'])).catch((e) => {
    worker = null;
    throw e;
  }));

export async function recognizeText(uri: string): Promise<string[] | null> {
  const w = await getWorker();
  const { data } = await w.recognize(uri);
  // คงช่องว่างตามที่อ่านได้ (แยกคำนำหน้า · ชื่อ · นามสกุล ด้วยช่องว่าง)
  return data.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}
