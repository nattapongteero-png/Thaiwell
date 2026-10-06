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
import { createClient } from '@supabase/supabase-js';
import { getItem, setItem } from './persist';
import type { ClinicEvent, ClinicPatient, ClinicRequest } from './clinicBridge';

/** ค่าเชื่อมต่อมาจาก .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY — ดู .env.example) ไม่เก็บในโค้ด */
export const CLOUD_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const CLOUD_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
/** ตั้งค่า cloud ไว้แล้ว (ไม่มี = แอปทำงานแบบเดิม: localStorage บนเว็บ / จำลองการยืนยันเองบนมือถือ) */
export const CLOUD_CONFIGURED = !!CLOUD_URL && !!CLOUD_KEY;
export const cloud = createClient(CLOUD_URL || 'https://cloud.invalid', CLOUD_KEY || 'none', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

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
  bill?: { amount: number; items?: string[]; status: 'pending' | 'paid'; method?: string; receipt_no?: string; paid_at?: string; via?: 'app' | 'clinic' } | null;
  plan?: { summary: string; sessions: number; frequency: string; phases?: { title: string; weeks: string; focus: string }[]; homeCare?: string[] } | null;
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
    const list = [...rows.values()].map(({ id, patient_id, status, queue_no, bill, plan, created_at, updated_at }) => ({ id, patient_id, status, queue_no, bill, plan, created_at, updated_at }));
    setItem(SEEN_KEY, JSON.stringify(list.slice(-300)));
  } catch {
    /* ignore */
  }
};

async function logEvent(kind: string, apptId: string | null, patientName: string | undefined, summary: string, payload?: unknown) {
  await cloud.from('tw_events').insert({ source: 'app', kind, appointment_id: apptId, patient_name: patientName ?? null, summary, payload: payload ?? null });
}

/** คำขอจอง + ผลประเมิน → แถวใหม่สถานะ requested (ลงทะเบียนผู้ป่วยใน cloud ด้วย) */
export async function cloudSendBooking(request: ClinicRequest, patient: ClinicPatient) {
  const it = request.intake;
  const service = request.serviceLabel ?? SERVICE_NAME[request.serviceId] ?? SERVICE_NAME.s1;
  const complaint = it?.complaint ?? patient.complaint;
  const { error: pe } = await cloud.from('tw_patients').upsert({ id: patient.id, name: patient.name, phone: patient.phone && patient.phone !== '-' ? patient.phone : null, gender: patient.gender, age: patient.age });
  if (pe) throw pe;
  const { error } = await cloud.from('tw_appointments').insert({
    id: request.id,
    patient_id: patient.id,
    status: 'requested',
    service,
    date: request.date,
    start: request.start,
    assessment: {
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

/** มาถึงคลินิก → checked_in (คลินิกออกเลขคิวแล้วเขียนกลับมาใน queue_no) */
export async function cloudCheckIn(id: string, who?: string) {
  const r = rows.get(id);
  if (r && r.status !== 'confirmed') return false;
  const { data, error } = await cloud.from('tw_appointments').update({ status: 'checked_in' }).eq('id', id).eq('status', 'confirmed').select('id');
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
export async function cloudCancel(id: string, who?: string) {
  const { data, error } = await cloud.from('tw_appointments').update({ status: 'cancelled', note: 'ผู้ป่วยยกเลิกจากแอป' }).eq('id', id).in('status', ['requested', 'confirmed', 'checked_in']).select('id');
  if (error) throw error;
  if (!data?.length) return false; // เริ่มรับบริการไปแล้ว → ยกเลิกจากแอปไม่ได้
  await logEvent('booking.cancelled', id, who, 'ผู้ป่วยยกเลิกนัดจากแอป');
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
    if (s === 'confirmed') out.push({ id: id('ok'), at, type: 'approved', ref: row.id, date: row.date ?? '', start: row.start ?? '', therapist: row.therapist ?? '', service: row.service ?? '', cloud: true });
    else if (s === 'rejected') out.push({ id: id('no'), at, type: 'rejected', ref: row.id, reason: row.note ?? '' });
    else if (s === 'called') out.push({ id: id('call'), at, type: 'queue', ref: row.id, queue: row.queue_no ?? '', called: true });
    else if (s === 'in_service') out.push({ id: id('start'), at, type: 'started', ref: row.id });
    else if (s === 'recorded') out.push({ id: id('done'), at, type: 'completed', ref: row.id, painBefore: row.record?.painBefore ?? 0, painAfter: row.record?.painAfter, cloud: true, record: row.record ?? undefined });
    else if (s === 'cancelled') out.push({ id: id('cancel'), at, type: 'cancelled', ref: row.id });
    else if (s === 'no_show') out.push({ id: id('absent'), at, type: 'absent', ref: row.id });
  }
  // เลขคิว: คลินิกออกให้หลังเช็กอิน (มาอีกรอบหลังสถานะ)
  if (s === 'checked_in' && row.queue_no && row.queue_no !== prev?.queue_no) out.push({ id: id('queue'), at, type: 'queue', ref: row.id, queue: row.queue_no, called: false });
  const b = row.bill;
  const pb = prev?.bill;
  if (b && JSON.stringify(b) !== JSON.stringify(pb ?? null)) {
    if (b.status === 'pending' && pb?.status !== 'pending') out.push({ id: id('bill'), at, type: 'bill', ref: row.id, patientId: row.patient_id, amount: b.amount, items: b.items ?? [] });
    // จ่ายที่คลินิก → ใบเสร็จ (จ่ายในแอปเองไม่ต้องแจ้งซ้ำ)
    if (b.status === 'paid' && pb?.status !== 'paid' && b.via !== 'app') out.push({ id: id('receipt'), at, type: 'receipt', ref: row.id, patientId: row.patient_id, amount: b.amount, receiptNo: b.receipt_no, paidAt: b.paid_at });
  }
  if (row.plan && JSON.stringify(row.plan) !== JSON.stringify(prev?.plan ?? null)) {
    out.push({ id: id('plan'), at, type: 'plan', patientId: row.patient_id, next: null, upcoming: 0, course: { name: row.plan.summary, total: row.plan.sessions, used: 1 }, summary: row.plan.summary, frequency: row.plan.frequency, homeCare: row.plan.homeCare });
  }
  return out;
}

/** ฟังความเปลี่ยนแปลงจากคลินิก: realtime + สำรองอ่านซ้ำทุก 6 วินาที · คืนฟังก์ชันเลิกฟัง */
export function listenCloud(cb: (events: ClinicEvent[]) => void): () => void {
  let stopped = false;
  const apply = (list: CloudRow[], emit: boolean) => {
    const out: ClinicEvent[] = [];
    for (const r of list) {
      const prev = rows.get(r.id);
      if (prev && prev.updated_at === r.updated_at && prev.status === r.status) continue;
      if (emit) out.push(...diffRow(prev, r));
      rows.set(r.id, r);
    }
    saveSeen();
    if (out.length) cb(out);
  };
  const fetchAll = async (emit: boolean) => {
    try {
      const { data, error } = await cloud.from('tw_appointments').select('*').neq('status', 'closed').order('created_at');
      online = !error;
      if (!error && data && !stopped) apply(data as CloudRow[], emit);
    } catch {
      online = false;
    }
  };
  // แถวที่มีอยู่ก่อนเปิดแอป = จุดตั้งต้น (ไม่เล่นเหตุการณ์เก่าซ้ำ) · เคยเห็นแล้ว (เว็บ) → รับเฉพาะที่เปลี่ยนระหว่างปิดแอป
  void fetchAll(loadSeen());
  const ch = cloud
    .channel('tw-app')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tw_appointments' }, (ev) => {
      const r = ev.new as CloudRow;
      if (r?.id && !stopped) apply([r], true);
    })
    .subscribe((s) => {
      if (s === 'SUBSCRIBED') online = true;
    });
  const t = setInterval(() => void fetchAll(true), 6000);
  return () => {
    stopped = true;
    clearInterval(t);
    void cloud.removeChannel(ch);
  };
}
