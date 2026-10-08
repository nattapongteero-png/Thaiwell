/**
 * สะพานไปหลังบ้านคลินิก (ต้นแบบ) — แอปผู้ป่วย ↔ ThaiWellAI back office ผ่าน localStorage ของเบราว์เซอร์เดียวกัน
 * ------------------------------------------------------------------
 * ทั้งสองเว็บอยู่ origin เดียวกัน (thaiwellai-svg.github.io/Thaiwell · /ThaiWellAI) → ใช้ที่เก็บข้อมูลร่วมกัน
 * เปิดแอปกับหลังบ้านคนละแท็บในเบราว์เซอร์เดียวกัน → ส่งถึงกันทันที (storage event + ตรวจทุก 2 วินาที)
 *
 *   toClinic: แอป → หลังบ้าน (คำขอจอง + แบบประเมินก่อนรับบริการ · แจ้งเตือนทั่วไป)
 *   toApp:    หลังบ้าน → แอป (อนุมัติ/ปฏิเสธ · นวดเสร็จพร้อมคะแนนหลังนวด · ยกเลิก/ไม่มาตามนัด)
 * หลังบ้านไม่ได้เปิด (ไม่มี heartbeat) → แอปจำลองการยืนยันเองเหมือนเดิม
 * รูปแบบข้อมูลตรงกับ ThaiWellAI/src/features/appBridge.ts (BookingRequest · Patient · Intake ของหลังบ้าน)
 * ⚠️ ต้นแบบ: ข้อมูลตัวอย่างเท่านั้น — ของจริงต้องผ่าน backend (ยืนยันตัวตน · เข้ารหัส · PDPA)
 *
 * บนมือถือ (iOS/Android) ไม่มี localStorage ร่วมกับหลังบ้าน → ใช้สะพาน cloud (Supabase) แทน ดู cloudBridge.ts
 * เว็บยังใช้ localStorage ตามเดิม (ตั้ง EXPO_PUBLIC_CLOUD=1 ตอน build ถ้าต้องการให้เว็บใช้ cloud ด้วย)
 */
import { Platform } from 'react-native';
import { CLOUD_CONFIGURED, cloudAvailabilityRaw, cloudCancel, cloudCheckIn, cloudNote, cloudPreVisit, cloudOnline, cloudPay, cloudSendBooking, listenCloud, cloudRows, type CloudRow, cloudPatientRows } from './cloudBridge';

/** ใช้สะพาน cloud (ข้ามเครื่อง) แทน localStorage (เบราว์เซอร์เดียวกัน) — ต้องมีค่าใน .env ก่อน */
export const CLOUD = CLOUD_CONFIGURED && (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_CLOUD === '1');
export const isCloud = () => CLOUD;

export const BRIDGE_KEY = 'thaiwell.bridge';
const CLINIC_ALIVE_KEY = 'thaiwell.bridge.clinicAlive';
const SEEN_KEY = 'thaiwell.bridge.seenByApp';

/** โครงข้อมูลฝั่งหลังบ้าน (เฉพาะที่ส่ง) */
export interface ClinicPatient {
  id: string;
  hn: string;
  name: string;
  gender: 'ชาย' | 'หญิง';
  age: number;
  phone: string;
  conditions: string[];
  complaint: string;
  painHistory: { date: string; score: number }[];
  registeredOn: string;
  birthDate?: string;
  /** บัญชีจริง: user id + ข้อมูลตามบัตรประชาชน (ส่งไปลงทะเบียนที่คลินิก) */
  userId?: string;
  email?: string;
  citizenId?: string;
  title?: string;
  address?: string;
  /** avatar ที่ผู้ใช้เลือก → คลินิกแสดงรูปเดียวกัน */
  avatar?: string;
}
/** แนวทางการรักษาที่แอปแนะนำตอนประเมิน (Knowledge Hub) — ผู้ให้บริการยืนยันอีกครั้งก่อนเริ่ม */
export interface AppGuide {
  condition?: string;
  methods: string[];
  points: string[];
  caution?: string;
  ref?: string;
}
export interface ClinicRequest {
  id: string;
  guide?: AppGuide;
  patientId: string;
  serviceId: string;
  therapistId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  painScore: number;
  /** ประเมินอาการแล้วหรือยัง (จองก่อนประเมิน = false → ไม่ส่งค่าเริ่มต้น ให้หลังบ้านขึ้น "ไม่ได้ประเมิน") */
  assessed?: boolean;
  /** ตอบข้อห้ามนวดแล้ว (ตอบ "ไม่มี" ก็นับ) → หลังบ้านแสดง "ไม่มี" รายข้อ ไม่ใช่ "ไม่ได้ประเมิน" */
  screened?: boolean;
  /** คำตอบดิบจากแบบประเมิน → คลินิกรู้ว่าข้อไหนตอบแล้ว (answered) */
  answers?: { duration?: string; health?: string; meds?: string; allergy?: string; risk?: string; radiate?: string; related?: string[]; pressure?: string };
  screening: { fever: boolean; highBP: boolean; menstruation: boolean; pregnant: boolean; recentSurgery: boolean; contagious: boolean };
  intake?: {
    at: string;
    goal: string;
    complaint: string;
    pain: number;
    duration: string;
    focusAreas: string[];
    avoidAreas: string[];
    conditions: string[];
    medications: string[];
    bloodThinner: boolean;
    skin: string;
    numbness: boolean;
    fever: boolean;
    pregnant: boolean | null;
    pressure: 'เบา' | 'ปานกลาง' | 'หนัก';
    injury?: string;
    surgery?: string;
    allergy?: string;
  };
  note?: string;
  submittedAt: string;
  /** ชื่อบริการที่ผู้ใช้เลือกในแอป (สะพาน cloud ส่งให้คลินิกเห็น) */
  serviceLabel?: string;
}

export type ClinicEvent =
  /** cloud = เลขคิวมาจากคลินิกตอนเช็กอิน (แอปไม่ออกเลขคิวเอง) */
  /** moved = คลินิกเปลี่ยนวัน/เวลา/ผู้บำบัดของนัดที่ยืนยันแล้ว · byClinic = คลินิกลงนัดเอง (นัดตามแผน) ไม่ได้มาจากคำขอจองในแอป */
  | { id: string; at: string; type: 'approved'; ref: string; date: string; start: string; therapist: string; service: string; cloud?: boolean; moved?: boolean; byClinic?: boolean; patientId?: string; course?: { name: string; no: number; total: number } }
  | { id: string; at: string; type: 'rejected'; ref: string; reason: string }
  /** cloud = คลินิกเป็นคนออกบิล (แอปไม่จำลองบิล) · record = ผลการรักษาที่คลินิกบันทึก */
  | { id: string; at: string; type: 'completed'; ref: string; painBefore: number; painAfter?: number; cloud?: boolean; record?: { findings?: string; diagnoses?: string[]; procedures?: string[]; advice?: string; therapist?: string } }
  | { id: string; at: string; type: 'cancelled' | 'absent'; ref: string; reason?: string }
  /** คลินิกเลื่อนนัด (วัน/เวลา/ผู้ให้บริการ/บริการ) */
  | { id: string; at: string; type: 'moved'; ref: string; date: string; start: string; therapist: string; service: string }
  /** คลินิกยกเลิกใบเสร็จ → รอชำระใหม่ */
  | { id: string; at: string; type: 'billVoid'; ref: string }
  /** เลขคิวจากคลินิก (หลังเช็กอิน) · called = ถึงคิวแล้ว */
  | { id: string; at: string; type: 'queue'; ref: string; queue: string; called: boolean }
  /** เช็กอินไม่ผ่าน (รหัส QR ผิด/หมดอายุ/ไม่ใช่วันนัด) → สแกนใหม่ */
  | { id: string; at: string; type: 'checkinRejected'; ref: string; reason: string }
  /** เริ่มรับบริการแล้ว */
  | { id: string; at: string; type: 'started'; ref: string }
  /** หลังบ้านลบนัดนี้ออกจากระบบ (ล้างข้อมูลผู้ป่วย/ล้างทั้งหมด) → แอปเอาออกตาม */
  | { id: string; at: string; type: 'deleted'; ref: string }
  /** คลินิกส่งบิลมาเรียกเก็บในแอป */
  | { id: string; at: string; type: 'bill'; ref: string; patientId: string; amount: number; items: string[]; /** รายการพร้อมราคา (ค่าบริการ + หัตถการเพิ่ม) */ lines?: { name: string; amount: number }[]; /** เลขใบเสร็จที่คลินิกจองไว้ให้บิลนี้ */ receiptNo?: string; therapist?: string }
  /** จ่ายแล้ว → ใบเสร็จ · method = วิธีชำระของคลินิก (cash · promptpay · app · credit) · quiet = จ่ายในแอปเอง แค่เติมเลข/รายการจริง (ไม่แจ้งเตือนซ้ำ) */
  | { id: string; at: string; type: 'receipt'; ref: string; patientId: string; amount: number; receiptNo?: string; paidAt?: string; method?: string; therapist?: string; lines?: { name: string; amount: number }[]; quiet?: boolean }
  /** นวดครั้งต่อ ๆ ไปตามแผน (นัดที่คลินิกลงเอง) */
  | { id: string; at: string; type: 'visit'; patientId: string; apptId: string; date: string; painBefore: number; painAfter: number }
  /** แผนการรักษา: นัดถัดไปที่คลินิกลงไว้ + คอร์ส */
  | { id: string; at: string; type: 'plan'; patientId: string; next: { date: string; start: string; therapist: string } | null; upcoming: number; course?: { name: string; total: number; used: number }; summary?: string; frequency?: string; homeCare?: string[] };

const store = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
type Box = { toClinic: { id: string }[]; toApp: ClinicEvent[] };
const box = (): Box => ({ toClinic: [], toApp: [], ...read<Partial<Box>>(BRIDGE_KEY, {}) });
const push = (event: Record<string, unknown>) => {
  const b = box();
  write(BRIDGE_KEY, { ...b, toClinic: [...b.toClinic, { ...event, id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() }].slice(-200) });
};

/** เวลาว่างจริงของคลินิก (หลังบ้านประกาศ) — days[YYYY-MM-DD][HH:mm][s1–s5] = id ผู้บำบัดที่ว่าง · (สะพาน localStorage เท่านั้น — มือถือใช้ตารางตัวอย่างของแอป) */
export interface Availability {
  at: string;
  clinicName: string;
  clinic?: { name: string; address?: string; phone?: string; lat?: number; lng?: number };
  /** คิววันนี้ของคลินิก (เฉพาะเลขคิว) */
  queue?: { date: string; serving?: string; waiting: string[] };
  therapists: { id: string; name: string; role: string; photo?: string }[];
  days: Record<string, Record<string, Record<string, string[]>>>;
}
const AVAILABILITY_KEY = 'thaiwell.bridge.availability';
export const availabilityRaw = () => {
  // มือถือ (cloud): หลังบ้านประกาศเวลาว่างไว้ใน cloud
  if (CLOUD) return cloudAvailabilityRaw();
  try {
    return store()?.getItem(AVAILABILITY_KEY) ?? null;
  } catch {
    return null;
  }
};
export const readAvailability = (): Availability | null => {
  try {
    const raw = availabilityRaw();
    return raw ? (JSON.parse(raw) as Availability) : null;
  } catch {
    return null;
  }
};
/** ผู้บำบัดของหลังบ้านสำหรับคำขอจอง: ตามชื่อที่เลือก · ไม่ระบุ = คนแรกที่ว่างรอบนั้น */
export function clinicTherapistId(name: string, date: string, start: string, serviceId: string): string | undefined {
  const a = readAvailability();
  if (!a) return undefined;
  return a.therapists.find((t) => t.name === name)?.id ?? a.days[date]?.[start]?.[serviceId]?.[0];
}

/** หลังบ้านเปิดอยู่ในเบราว์เซอร์นี้ (heartbeat ไม่เกิน 8 วินาที) · cloud: ต่อ Supabase ได้ */
export const clinicOnline = () => (CLOUD ? cloudOnline() : Date.now() - Number(store()?.getItem(CLINIC_ALIVE_KEY) ?? 0) < 8000);

export const sendBooking = (request: ClinicRequest, patient: ClinicPatient) => {
  if (CLOUD) void cloudSendBooking(request, patient).catch(() => undefined);
  else push({ type: 'booking', request, patient });
};
export const sendNote = (title: string, body: string, patientId?: string, patientName?: string) => {
  if (!clinicOnline()) return false;
  if (CLOUD) void cloudNote(title, body, patientId, patientName).catch(() => undefined);
  else push({ type: 'note', title, body, patientId });
  return true;
};
/** เช็กอินที่คลินิก (เฉพาะสะพาน cloud — localStorage ไม่มีขั้นนี้) */
/** code = รหัสจาก QR เช็กอินที่เคาน์เตอร์ (คลินิกตรวจก่อนออกเลขคิว) */
export const sendCheckIn = (ref: string, who?: string, code?: string) => (CLOUD ? cloudCheckIn(ref, who, code).catch(() => false) : Promise.resolve(false));
/** ประเมินก่อนนวด → แถวนัดครั้งนั้น (เฉพาะ cloud) · true = หลังบ้านได้รับแล้ว */
export const sendPreVisit = (ref: string, pv: Parameters<typeof cloudPreVisit>[1], who?: string) => (CLOUD && clinicOnline() ? cloudPreVisit(ref, pv, who).catch(() => false) : Promise.resolve(false));
/** ยกเลิกนัดที่ส่งไปแล้ว */
export const sendCancel = (ref: string, who?: string, reason?: string) => (CLOUD ? cloudCancel(ref, who, reason).catch(() => false) : Promise.resolve(true));
/** จ่ายบิลในแอป → คลินิกเห็นว่าชำระแล้ว */
export const sendPayment = (ref: string, who?: string) => {
  if (CLOUD) void cloudPay(ref, who).catch(() => undefined);
};

/** เหตุการณ์จากหลังบ้านที่แอปยังไม่ได้รับ (แล้วจำว่ารับแล้ว) */
export function takeClinicEvents(): ClinicEvent[] {
  const seen = new Set(read<string[]>(SEEN_KEY, []));
  const fresh = box().toApp.filter((e) => !seen.has(e.id));
  if (fresh.length) write(SEEN_KEY, [...seen, ...fresh.map((e) => e.id)].slice(-500));
  return fresh;
}

/** ฟังเหตุการณ์จากหลังบ้าน (เว็บเท่านั้น) · คืนฟังก์ชันเลิกฟัง */
export function listenClinic(cb: (events: ClinicEvent[]) => void): () => void {
  if (CLOUD) return listenCloud(cb);
  if (!store() || typeof window === 'undefined' || !window.addEventListener) return () => {};
  // เหตุการณ์เก่าก่อนเปิดแอป → ไม่นำมาใช้ซ้ำ (ข้อมูลแอปอยู่ในหน่วยความจำ เริ่มใหม่ทุกครั้งที่เปิด)
  takeClinicEvents();
  const pull = () => {
    const ev = takeClinicEvents();
    if (ev.length) cb(ev);
  };
  const onStorage = (e: StorageEvent) => e.key === BRIDGE_KEY && pull();
  window.addEventListener('storage', onStorage);
  const t = setInterval(pull, 2000);
  return () => {
    window.removeEventListener('storage', onStorage);
    clearInterval(t);
  };
}

/* ---------- แปลงข้อมูลแอป → หลังบ้าน ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** "วันนี้" / "พรุ่งนี้" / "พฤ. 9 ต.ค." → YYYY-MM-DD */
export function labelToISO(label: string): string {
  const d = new Date();
  if (label === 'พรุ่งนี้') d.setDate(d.getDate() + 1);
  else if (label !== 'วันนี้') {
    const m = /(\d{1,2})\s+(\S+)$/.exec(label);
    const mi = m ? MONTHS.indexOf(m[2]) : -1;
    if (m && mi >= 0) {
      const y = mi < d.getMonth() ? d.getFullYear() + 1 : d.getFullYear();
      return `${y}-${pad(mi + 1)}-${pad(Number(m[1]))}`;
    }
  }
  return iso(d);
}
/** YYYY-MM-DD → "วันนี้" / "พรุ่งนี้" / "พฤ. 9 ต.ค." */
export function isoToLabel(date: string): string {
  const [y, m, dd] = date.split('-').map(Number);
  const target = new Date(y, m - 1, dd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'พรุ่งนี้';
  return `${['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][target.getDay()]} ${dd} ${MONTHS[m - 1]}`;
}
export const todayISO = () => iso(new Date());
/** ป้ายบริการของแอป → รหัสบริการหลังบ้าน (s1–s5) */
export const serviceCodeOf = (label: string) =>
  /ร่วมประคบ|\+ ?ประคบ/.test(label) ? 's5' : /เพื่อการรักษา|นวดรักษา/.test(label) ? 's2' : /^ประคบ/.test(label) ? 's3' : /เท้า/.test(label) ? 's4' : 's1';
/** วันเกิด "DD/MM/YYYY" (พ.ศ. หรือ ค.ศ.) → YYYY-MM-DD (ค.ศ.) */
export function birthToISO(b?: string): string | undefined {
  const m = b ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(b) : null;
  if (!m) return undefined;
  const y = Number(m[3]) > 2400 ? Number(m[3]) - 543 : Number(m[3]);
  return `${y}-${m[2]}-${m[1]}`;
}

/** สถานะปัจจุบันของนัดใน cloud (ไม่ใช้ cloud → ว่าง) */
export const fetchCloudRows = (ids: string[]): Promise<CloudRow[]> => (CLOUD ? cloudRows(ids).catch(() => []) : Promise.resolve([]));
/** นัดที่ยังไม่จบของผู้ป่วยคนนี้ใน cloud (รวมนัดที่คลินิกลงเองตามแผน) */
export const fetchPatientRows = (patientId: string): Promise<CloudRow[] | null> => (CLOUD ? cloudPatientRows(patientId).catch(() => null) : Promise.resolve(null));
export type { CloudRow };
