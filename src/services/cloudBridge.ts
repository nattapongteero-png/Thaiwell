/**
 * สะพาน cloud (ต้นแบบ) — แอปผู้ป่วย ↔ หลังบ้าน ThaiWellAI ผ่าน Supabase (ตารางตาม ThaiWellAI/supabase/schema.sql)
 * ------------------------------------------------------------------
 * ใช้บนมือถือ (iOS/Android) และบนเว็บเมื่อตั้ง EXPO_PUBLIC_CLOUD=1 — ข้ามเครื่อง/ข้ามเครือข่ายได้ ไม่ต้องอยู่เบราว์เซอร์เดียวกัน
 * นัด 1 รายการ = แถวใน tw_appointments ที่เดินสถานะ requested → confirmed → checked_in → called → in_service → recorded → billed → paid
 *   แอปเขียน:    requested (+ ผลประเมิน) · checked_in · paid (จ่ายในแอป) · cancelled · โน้ต (tw_events)
 *   คลินิกเขียน: confirmed / rejected · queue_no · called · in_service · record · bill · plan
 * แอปแปลงความเปลี่ยนแปลงของแถวเป็น ClinicEvent ชุดเดียวกับสะพาน localStorage → JourneyContext ใช้ตัวจัดการเดิม
 * ⚠️ ต้นแบบ: key แบบ publishable เปิดอ่าน/เขียนทุกตาราง — ข้อมูลตัวอย่างเท่านั้น ของจริงต้องมี auth + RLS รายคน
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { getItem, setItem } from './persist';
import type { ClinicEvent, ClinicPatient, ClinicRequest } from './clinicBridge';

/** ค่าเชื่อมต่อมาจาก .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY — ดู .env.example) ไม่เก็บในโค้ด */
export const CLOUD_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const CLOUD_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
/** ตั้งค่า cloud ไว้แล้ว (ไม่มี = แอปทำงานแบบเดิม: localStorage บนเว็บ / จำลองการยืนยันเองบนมือถือ) */
export const CLOUD_CONFIGURED = !!CLOUD_URL && !!CLOUD_KEY;
// บัญชีผู้ใช้ (Supabase Auth): จำการเข้าสู่ระบบไว้ในเครื่อง — มือถือใช้ AsyncStorage · เว็บใช้ localStorage
export const cloud = createClient(CLOUD_URL || 'https://cloud.invalid', CLOUD_KEY || 'none', {
  auth: { storage: Platform.OS === 'web' ? undefined : AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** แถวใน tw_appointments (เฉพาะที่แอปใช้) */
export interface CloudRow {
  id: string;
  patient_id: string;
  status: string;
  service?: string | null;
  date?: string | null;
  start?: string | null;
  therapist?: string | null;
  queue_no?: string | null;
  record?: { findings?: string; diagnoses?: string[]; procedures?: string[]; painBefore?: number; painAfter?: number; advice?: string; therapist?: string } | null;
  bill?: { amount: number; items?: string[]; lines?: { name: string; amount: number }[]; status: 'pending' | 'paid' | 'void'; method?: string; receipt_no?: string; paid_at?: string; via?: 'app' | 'clinic' } | null;
  plan?: { summary: string; sessions: number; frequency: string; phases?: { title: string; weeks: string; focus: string }[]; homeCare?: string[]; course?: { name: string; total: number; used: number } } | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

/** ชื่อบริการของหลังบ้าน (Service.name) ตามรหัส s1–s5 — ใช้เมื่อไม่มีป้ายบริการจากแอป */
const SERVICE_NAME: Record<string, string> = { s1: 'นวดไทยเพื่อสุขภาพ', s2: 'นวดไทยเพื่อการรักษา', s3: 'ประคบสมุนไพร', s4: 'นวดเท้า', s5: 'นวดไทยเพื่อการรักษา + ประคบ' };

let online = false;
/** ต่อ cloud ได้ (อ่านตารางสำเร็จแล้วอย่างน้อยหนึ่งครั้ง) */
export const cloudOnline = () => online;

/** แถวล่าสุดที่แอปเห็น — ใช้หาความเปลี่ยนแปลง และดูบิลตอนจ่าย */
const rows = new Map<string, CloudRow>();

/* จำแถวที่เห็นล่าสุด → เปิดแอปใหม่ได้รับสิ่งที่คลินิกทำระหว่างปิดแอป (ไม่เล่นซ้ำของที่รับไปแล้ว) */
export const SEEN_KEY = 'thaiwell.cloud.seen';
const loadSeen = () => {
  try {
    const raw = getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as CloudRow[]) : [];
    for (const r of list) rows.set(r.id, r);
    return list.length > 0;
  } catch {
    return false;
  }
};
const saveSeen = () => {
  try {
    // เก็บเฉพาะที่ใช้หาความเปลี่ยนแปลง
    const list = [...rows.values()].map(({ id, patient_id, status, service, date, start, therapist, queue_no, bill, plan, created_at, updated_at }) => ({ id, patient_id, status, service, date, start, therapist, queue_no, bill, plan, created_at, updated_at }));
    setItem(SEEN_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    /* ignore */
  }
};
/* ---------- เวลาว่างจริงของคลินิก (หลังบ้านประกาศไว้ใน tw_events id = -1) ---------- */
let availRaw: string | null = null;
export const cloudAvailabilityRaw = () => availRaw;
const availListeners = new Set<() => void>();
/** เวลาว่าง/ข้อมูลคลินิกเปลี่ยน → แจ้ง (เช่น รายการสถานที่) */
export const onAvailability = (cb: () => void) => {
  availListeners.add(cb);
  return () => void availListeners.delete(cb);
};
export async function refreshAvailability() {
  const { data } = await cloud.from('tw_events').select('payload').eq('id', -1).maybeSingle();
  const next = data?.payload ? JSON.stringify(data.payload) : null;
  if (next === availRaw) return;
  availRaw = next;
  availListeners.forEach((l) => l());
}
/** สถานะปัจจุบันของนัดใน cloud (ใช้ตั้งต้นบัญชีตัวอย่างให้ตรงกับคลินิก) */
export async function cloudRows(ids: string[]): Promise<CloudRow[]> {
  const { data } = await cloud.from('tw_appointments').select('*').in('id', ids);
  return (data ?? []) as CloudRow[];
}

async function logEvent(kind: string, apptId: string | null, patientName: string | undefined, summary: string, payload?: unknown) {
  await cloud.from('tw_events').insert({ source: 'app', kind, appointment_id: apptId, patient_name: patientName ?? null, summary, payload: payload ?? null });
}

/** คำขอจอง + ผลประเมิน → แถวใหม่สถานะ requested (ลงทะเบียนผู้ป่วยใน cloud ด้วย) */
export async function cloudSendBooking(request: ClinicRequest, patient: ClinicPatient) {
  const it = request.intake;
  // ชื่อบริการตามที่ผู้ป่วยเห็น (ไม่มีระยะเวลา) · คลินิกใช้รหัส serviceId เป็นหลัก
  const service = (request.serviceLabel ?? SERVICE_NAME[request.serviceId] ?? SERVICE_NAME.s1).split(' · ')[0];
  const complaint = it?.complaint ?? patient.complaint;
  const { data: old } = await cloud.from('tw_patients').select('profile').eq('id', patient.id).maybeSingle();
  const { error: pe } = await cloud.from('tw_patients').upsert({
    id: patient.id,
    name: patient.name,
    phone: patient.phone && patient.phone !== '-' ? patient.phone : null,
    gender: patient.gender,
    age: patient.age,
    // บัญชีจริง: ผูกกับบัญชี + ข้อมูลตามบัตรประชาชน (คลินิกลงทะเบียนให้ตรงคน)
    ...(patient.userId ? { user_id: patient.userId, email: patient.email ?? null, citizen_id: patient.citizenId ?? null, title: patient.title ?? null, birth_date: patient.birthDate ?? null, address: patient.address ?? null, profile: { ...((old?.profile as object) ?? {}), avatar: patient.avatar } } : {}),
  });
  if (pe) throw pe;
  const { error } = await cloud.from('tw_appointments').insert({
    id: request.id,
    patient_id: patient.id,
    status: 'requested',
    service,
    date: request.date,
    start: request.start,
    assessment: {
      at: new Date().toISOString(),
      serviceId: request.serviceId,
      therapistId: request.therapistId || undefined,
      complaint,
      pain: request.painScore,
      areas: it?.focusAreas ?? [],
      avoid: it?.avoidAreas ?? [],
      conditions: it?.conditions ?? patient.conditions,
      pressure: it?.pressure ?? 'ปานกลาง',
      screening: request.screening,
      summary: `AI ประเมิน: ${complaint} · ปวด ${request.painScore}/10${request.note ? ` · ${request.note}` : ''}`,
    },
  });
  if (error) throw error;
  await logEvent('booking.requested', request.id, patient.name, `ประเมินอาการแล้ว ส่งคำขอจอง ${service} ${request.date} ${request.start} น.`);
}

/** ข้อมูลประเมินที่เปลี่ยนได้ในรอบใหม่ */
export interface ReassessPatch {
  complaint?: string;
  pain?: number;
  areas?: string[];
  avoid?: string[];
  summary?: string;
  screening?: Record<string, boolean | number | undefined>;
}
/**
 * ประเมินใหม่ก่อนเช็กอิน → รอบใหม่ (รอบเดิมเก็บไว้ใน rounds ไม่ทับ) · เช็กอินแล้ว/เริ่มรับบริการ = ไม่รับ (คืน false)
 * คลินิกใช้ผลรอบล่าสุด และเห็นว่าเปลี่ยนจากเดิมตรงไหน
 */
export async function cloudReassess(id: string, patch: ReassessPatch) {
  const { data: cur } = await cloud.from('tw_appointments').select('assessment,status,queue_no').eq('id', id).maybeSingle();
  if (!cur || !['requested', 'confirmed'].includes(cur.status as string) || cur.queue_no) return false;
  const old = (cur.assessment ?? {}) as Record<string, unknown> & { rounds?: Record<string, unknown>[]; addenda?: unknown[] };
  const { rounds, addenda, ...prev } = old;
  const next = { ...prev, ...patch, at: new Date().toISOString(), rounds: [...(rounds ?? []), prev], ...(addenda ? { addenda } : {}) };
  const { data, error } = await cloud.from('tw_appointments').update({ assessment: next }).eq('id', id).in('status', ['requested', 'confirmed']).is('queue_no', null).select('id');
  if (error) throw error;
  return !!data?.length;
}
/** หลังเช็กอิน: แจ้งอาการเพิ่ม (แปะไว้กับรอบเดิม ไม่แก้ผลประเมิน) */
export async function cloudAddendum(id: string, text: string) {
  const { data: cur } = await cloud.from('tw_appointments').select('assessment,status').eq('id', id).maybeSingle();
  if (!cur || !['checked_in', 'called', 'in_service'].includes(cur.status as string)) return false;
  const old = (cur.assessment ?? {}) as Record<string, unknown> & { addenda?: { at: string; text: string }[] };
  const { error } = await cloud.from('tw_appointments').update({ assessment: { ...old, addenda: [...(old.addenda ?? []), { at: new Date().toISOString(), text }] } }).eq('id', id);
  if (error) throw error;
  return true;
}

/** มาถึงคลินิก → checked_in (คลินิกออกเลขคิวแล้วเขียนกลับมาใน queue_no) */
export async function cloudCheckIn(id: string, who?: string, code?: string) {
  const r = rows.get(id);
  if (r && r.status !== 'confirmed') return false;
  const { data, error } = await cloud.from('tw_appointments').update({ status: 'checked_in', note: code ? `checkin:${code.toUpperCase()}` : null }).eq('id', id).eq('status', 'confirmed').select('id');
  if (error) throw error;
  if (!data?.length) return false; // ไม่ได้อยู่ในสถานะยืนยันแล้ว (เช็กอินไปแล้ว / คลินิกยังไม่ยืนยัน)
  await logEvent('visit.checked_in', id, who, 'มาถึงคลินิก กดเช็กอินในแอป');
  return true;
}

/** จ่ายบิลในแอป → paid (คลินิกเห็นว่าชำระแล้วและปิดบิลเอง) */
export async function cloudPay(id: string, who?: string) {
  const b = rows.get(id)?.bill;
  if (!b) return false;
  const { error } = await cloud
    .from('tw_appointments')
    .update({ status: 'paid', bill: { ...b, status: 'paid', method: 'app', via: 'app', paid_at: new Date().toISOString() } })
    .eq('id', id);
  if (error) throw error;
  await logEvent('bill.paid', id, who, `ชำระ ${b.amount} บาท ผ่านแอป (พร้อมเพย์)`);
  return true;
}

/** ผู้ป่วยยกเลิกนัดในแอป (ก่อนเริ่มรับบริการ) */
export async function cloudCancel(id: string, who?: string, reason = 'ผู้ป่วยยกเลิกจากแอป') {
  const { data, error } = await cloud.from('tw_appointments').update({ status: 'cancelled', note: reason }).eq('id', id).in('status', ['requested', 'confirmed', 'checked_in']).select('id');
  if (error) throw error;
  if (!data?.length) return false; // เริ่มรับบริการไปแล้ว → ยกเลิกจากแอปไม่ได้
  await logEvent('booking.cancelled', id, who, reason);
  return true;
}

/** แจ้งคลินิกนอกเหนือจากนัด (ประเมินก่อนนวด · ความรู้สึกหลังนวด · ร้องเรียน) → หลังบ้านขึ้นเป็นการแจ้งเตือน */
export async function cloudNote(title: string, body: string, patientId?: string, patientName?: string) {
  await logEvent('app.note', null, patientName, `${title} · ${body}`, { title, body, patientId });
}

/** ความเปลี่ยนแปลงของแถว → เหตุการณ์ที่แอปเข้าใจ (ชุดเดียวกับสะพาน localStorage + คิว/บิล/ใบเสร็จ) */
export function diffRow(prev: CloudRow | undefined, row: CloudRow): ClinicEvent[] {
  const out: ClinicEvent[] = [];
  const at = row.updated_at;
  const id = (k: string) => `${row.id}:${k}:${at}`;
  const s = row.status;
  const p = prev?.status;
  if (s !== p) {
    // คลินิกส่งเช็กอินกลับ (รหัส QR ไม่ผ่าน) → ไม่ใช่การยืนยันนัดใหม่
    if (s === 'confirmed' && p === 'checked_in' && (row.note ?? '').startsWith('checkin-rejected')) out.push({ id: id('ckno'), at, type: 'checkinRejected', ref: row.id, reason: (row.note ?? '').replace(/^checkin-rejected:\s*/, '') });
    else if (s === 'confirmed') {
      const as = (row as CloudRow & { assessment?: { source?: string; course?: { name: string; no: number; total: number } } }).assessment;
      out.push({ id: id('ok'), at, type: 'approved', ref: row.id, date: row.date ?? '', start: row.start ?? '', therapist: row.therapist ?? '', service: row.service ?? '', cloud: true, byClinic: as?.source === 'clinic', patientId: row.patient_id, course: as?.course });
    }
    else if (s === 'rejected') out.push({ id: id('no'), at, type: 'rejected', ref: row.id, reason: row.note ?? '' });
    else if (s === 'called') out.push({ id: id('call'), at, type: 'queue', ref: row.id, queue: row.queue_no ?? '', called: true });
    else if (s === 'in_service') out.push({ id: id('start'), at, type: 'started', ref: row.id });
    // คลินิกยกเลิกใบเสร็จ (ถอยจากชำระแล้ว/ส่งบิล) → ไม่ใช่การนวดเสร็จครั้งใหม่
    else if (s === 'recorded' && (p === 'billed' || p === 'paid')) out.push({ id: id('void'), at, type: 'billVoid', ref: row.id });
    else if (s === 'recorded') out.push({ id: id('done'), at, type: 'completed', ref: row.id, painBefore: row.record?.painBefore ?? 0, painAfter: row.record?.painAfter, cloud: true, record: row.record ?? undefined });
    else if (s === 'cancelled') out.push({ id: id('cancel'), at, type: 'cancelled', ref: row.id, reason: row.note ?? undefined });
    else if (s === 'no_show') out.push({ id: id('absent'), at, type: 'absent', ref: row.id });
  }
  // คลินิกเลื่อนนัด (สถานะเดิม) → วัน/เวลา/ผู้ให้บริการใหม่
  else if (prev && prev.date !== undefined && ['confirmed', 'checked_in'].includes(s) && (row.date !== prev.date || row.start !== prev.start || (row.therapist ?? '') !== (prev.therapist ?? '')))
    out.push({ id: id('moved'), at, type: 'moved', ref: row.id, date: row.date ?? '', start: row.start ?? '', therapist: row.therapist ?? '', service: row.service ?? '' });
  // เลขคิว: คลินิกออกให้หลังเช็กอิน (มาอีกรอบหลังสถานะ)
  if (s === 'checked_in' && row.queue_no && row.queue_no !== prev?.queue_no) out.push({ id: id('queue'), at, type: 'queue', ref: row.id, queue: row.queue_no, called: false });
  const b = row.bill;
  const pb = prev?.bill;
  if (b && JSON.stringify(b) !== JSON.stringify(pb ?? null)) {
    // บิลใหม่ / คลินิกแก้ยอดระหว่างรอชำระ
    if (b.status === 'pending' && (pb?.status !== 'pending' || pb.amount !== b.amount)) out.push({ id: id('bill'), at, type: 'bill', ref: row.id, patientId: row.patient_id, amount: b.amount, items: b.items ?? [], lines: b.lines, receiptNo: b.receipt_no });
    // จ่ายที่คลินิก → ใบเสร็จ (จ่ายในแอปเองไม่ต้องแจ้งซ้ำ)
    if (b.status === 'paid' && pb?.status !== 'paid' && b.via !== 'app') out.push({ id: id('receipt'), at, type: 'receipt', ref: row.id, patientId: row.patient_id, amount: b.amount, receiptNo: b.receipt_no, paidAt: b.paid_at, lines: b.lines });
  }
  if (row.plan && JSON.stringify(row.plan) !== JSON.stringify(prev?.plan ?? null)) {
    out.push({ id: id('plan'), at, type: 'plan', patientId: row.patient_id, next: null, upcoming: 0, course: row.plan.course ?? { name: row.plan.summary, total: row.plan.sessions, used: 0 }, summary: row.plan.summary, frequency: row.plan.frequency, homeCare: row.plan.homeCare });
  }
  return out;
}

/** ฟังความเปลี่ยนแปลงจากคลินิก: realtime + สำรองอ่านซ้ำทุก 6 วินาที · คืนฟังก์ชันเลิกฟัง */
/* ---------- บัญชีจริง: ข้อมูลในแอปของแต่ละคน (tw_app_state) ---------- */
/** นัดที่คลินิกลงให้เอง (นัดตามคอร์ส) ที่ยังไม่จบ — แอปเทียบกับนัดในเครื่องทุกรอบ (ไม่พึ่งเหตุการณ์อย่างเดียว) */
export const clinicMadeRows = () =>
  [...rows.values()].filter((r) => (r as CloudRow & { assessment?: { source?: string } }).assessment?.source === 'clinic' && ['confirmed', 'checked_in', 'called', 'in_service'].includes(r.status));
/** สถานะนัดที่แอปเคยเห็นล่าสุด (เก็บกับข้อมูลแอป) → เปิดแอปใหม่ได้เหตุการณ์ที่เกิดระหว่างปิดแอปด้วย */
export const seenRows = () => Object.fromEntries(rows);
let gateOpen = false;
let wake: (() => void) | null = null;
/** ไม่มีบัญชีจริง (โหมดเดิม) → ใช้ที่เคยเห็นในเครื่องอย่างเดียว */
export function startLocalSync() {
  gateOpen = true;
  wake?.();
}
/** เริ่มฟังนัดของบัญชีนี้ หลังดึงข้อมูลแอปกลับมาแล้ว (seen = จุดตั้งต้นที่บันทึกไว้) */
export function startAccountSync(seen: Record<string, CloudRow>) {
  // ที่บัญชีเคยเห็น (เครื่องไหนก็ได้) + ที่เครื่องนี้เคยเห็น — ใช้อันที่ใหม่กว่า
  for (const [id, r] of Object.entries(seen)) {
    const cur = rows.get(id);
    if (!cur || (r.updated_at ?? '') > (cur.updated_at ?? '')) rows.set(id, r);
  }
  gateOpen = true;
  wake?.();
}
export function stopAccountSync() {
  gateOpen = false;
  rows.clear();
}
/** คอร์สการรักษาที่คลินิกเปิดให้ (คลินิกเขียนไว้ใน tw_patients.profile.course) */
export interface ClinicCourse {
  name: string;
  service: string;
  total: number;
  used: number;
  startedOn: string;
  expiresOn: string;
  /** prepaid = จ่ายคอร์สล่วงหน้าแล้ว · perVisit = ชำระรายครั้งที่มารักษา */
  billing?: 'prepaid' | 'perVisit';
}
/** ครั้งที่รักษาที่คลินิก (คลินิกบันทึก) */
export interface ClinicVisit {
  id: string;
  date: string;
  start: string;
  service: string;
  therapist: string;
  painBefore?: number;
  painAfter?: number;
  findings?: string;
  diagnoses?: string[];
  procedures?: string[];
  advice?: string;
}
/** คอร์ส + ประวัติการรักษาที่คลินิกส่งให้ (tw_patients.profile) */
export async function fetchMyCourse(userId: string): Promise<{ course: ClinicCourse | null; visits: ClinicVisit[]; resetAt?: string }> {
  const { data } = await cloud.from('tw_patients').select('profile').eq('user_id', userId).maybeSingle();
  const p = (data?.profile ?? {}) as { course?: ClinicCourse | null; visits?: ClinicVisit[]; resetAt?: string };
  // resetAt = คลินิกรีเซ็ตข้อมูลการรักษาของบัญชีนี้ (ทดสอบ) → แอปล้างข้อมูลการรักษาในเครื่องตาม
  return { course: p.course ?? null, visits: p.visits ?? [], resetAt: p.resetAt };
}
/** HN ที่คลินิกออกให้ (หลังคลินิกรับคำขอจองครั้งแรก) */
export async function fetchMyHn(userId: string): Promise<string | null> {
  const { data } = await cloud.from('tw_patients').select('clinic_hn').eq('user_id', userId).maybeSingle();
  return (data?.clinic_hn as string | null) ?? null;
}
export async function loadAppState(userId: string): Promise<Record<string, unknown> | null> {
  const { data } = await cloud.from('tw_app_state').select('state').eq('user_id', userId).maybeSingle();
  return (data?.state as Record<string, unknown>) ?? null;
}
export async function saveAppState(userId: string, state: Record<string, unknown>) {
  await cloud.from('tw_app_state').upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
}

export function listenCloud(cb: (events: ClinicEvent[]) => void): () => void {
  let stopped = false;
  const apply = (list: CloudRow[], emit: boolean, full = false) => {
    const out: ClinicEvent[] = [];
    // รายการเต็มจาก cloud: แถวที่ไม่มีแล้ว (คลินิกลบ/รีเซ็ต) → ลืม ไม่ให้ถูกดึงกลับมาเป็นนัดอีก
    if (full) {
      const ids = new Set(list.map((r) => r.id));
      for (const id of [...rows.keys()]) if (!ids.has(id)) rows.delete(id);
    }
    for (const r of list) {
      const prev = rows.get(r.id);
      // ไม่เปลี่ยน → ไม่มีเหตุการณ์ แต่เก็บแถวเต็มไว้ (ที่จำไว้ในเครื่องเก็บแค่บางช่อง)
      if (emit && !(prev && prev.updated_at === r.updated_at && prev.status === r.status)) out.push(...diffRow(prev, r));
      rows.set(r.id, r);
    }
    saveSeen();
    if (out.length) cb(out);
  };
  const fetchAll = async (emit: boolean) => {
    // ยังไม่ได้ดึงข้อมูลแอปของบัญชีกลับมา → ยังไม่ตั้งจุดตั้งต้น (ไม่อย่างนั้นเหตุการณ์ระหว่างปิดแอปจะหาย)
    if (!gateOpen) return;
    try {
      const { data, error } = await cloud.from('tw_appointments').select('*').neq('status', 'closed').order('created_at');
      online = !error;
      if (!error && data && !stopped) apply(data as CloudRow[], emit, true);
    } catch {
      online = false;
    }
  };
  // ตั้งต้นจากที่เคยเห็นในเครื่อง (เปิดแอปเร็ว) · บัญชีจริง: เทียบกับที่เคยเห็นของบัญชี (startAccountSync) แล้วรับที่เปลี่ยนระหว่างปิดแอป
  const hadLocal = loadSeen();
  wake = () => void fetchAll(true);
  if (gateOpen) void fetchAll(hadLocal);
  const ch = cloud
    .channel('tw-app')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tw_appointments' }, (ev) => {
      const r = ev.new as CloudRow;
      if (r?.id && !stopped) apply([r], true);
    })
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') online = true;
    });
  let tick = 0;
  void refreshAvailability().catch(() => undefined);
  // เข้าสู่ระบบแล้ว (สิทธิ์อ่านเวลาว่าง/นัดของตัวเอง) → ดึงใหม่ทันที
  const { data: authSub } = cloud.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED' || ev === 'INITIAL_SESSION') {
      void refreshAvailability().catch(() => undefined);
    }
  });
  // สำรอง realtime ทุก 3 วินาที (แจ้งเตือนไม่ช้าแม้ realtime หลุด)
  const t = setInterval(() => {
    void fetchAll(true);
    // เวลาว่างของคลินิก ทุก ~30 วินาที
    if (++tick % 10 === 0) void refreshAvailability().catch(() => undefined);
  }, 3000);
  return () => {
    stopped = true;
    authSub.subscription.unsubscribe();
    clearInterval(t);
    void cloud.removeChannel(ch);
  };
}
