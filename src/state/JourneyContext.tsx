/**
 * JOURNEY STATE — ข้อมูลที่ไหลต่อเนื่องตลอด Digital Thai Wellness Journey
 * (Pre-screen → Safety → Care Suggestion → Service Record → Follow-up)
 * Prototype เก็บใน memory; production = Health Profile / Wellness Encounter / Outcome / Consent / Audit (Data Layer)
 */
import { CHIP_PINS } from '../data/homeContent';
import { guideFor } from '../data/treatmentGuides';
import { serviceMinutesOf } from '../data/serviceMinutes';
import { DEMO_LINKS, DEMO_PATIENT_CLOUD_ID, TREATMENT_CASES, type TreatmentCase } from '../data/homeFeed';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RegionId } from '../design-system/components/BodyMap';
import { SYMPTOM_GROUPS, stretchGroupFor, type ElementKey } from '../data/thaiMassageKnowledge';
import { evaluateSafety, type HealthProfile, type SafetyResult } from '../services/safetyEngine';
import { submitFollowUp, type FollowUpPayload, type FollowUpRecord } from '../services/followUpService';
import { noticeOf, notify, setupNotifications } from '../services/notify';
import { getItem, removeItem, setItem } from '../services/persist';
import { fetchCloudRows, fetchPatientRows } from '../services/clinicBridge';
import { locate } from '../services/location';
import { cloudAddendum, cloudAfterPain, cloudReassess, cloudRowOf, cloudStatusOf, clinicMadeRows, missingAppointments, fetchMyCourse, fetchMyHn, type ClinicCourse, type ClinicVisit, loadAppState, saveAppState, seenRows, startAccountSync, startLocalSync, stopAccountSync, type CloudRow } from '../services/cloudBridge';
import type { IdCard } from '../services/idCard';
import { defaultAvatar } from '../data/staffAvatars';
import { signOutCloud } from '../services/auth';
import { readAvailability, birthToISO, clinicOnline, clinicTherapistId, isCloud, isoToLabel, labelToISO, listenClinic, sendBooking, sendCancel, sendCheckIn, sendNote, sendPayment, sendPreVisit, serviceCodeOf, todayISO, type ClinicEvent, type ClinicPatient, type ClinicRequest } from '../services/clinicBridge';

export interface Assessment {
  pain: number;
  stiffness: number;
  mobility: number; // 1–5
  stress: number; // 1–5
  sleep: number; // 1–5
}

export interface ServiceRecord {
  planId?: string;
  regions: string[];
  techniques: string[];
  pressure: string;
  duration: number;
  notes: string;
  provider: string;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
}

export interface Consents {
  service: boolean; // จำเป็น
  aiProcessing: boolean; // จำเป็นสำหรับ AI Interview
  followUp: boolean;
  research: boolean; // ไม่บังคับ (ข้อมูลไม่ระบุตัวตน)
}

const baseProfile: HealthProfile = {
  age: 34,
  conditions: ['ความดันโลหิตสูง'],
  medications: ['Amlodipine 5 mg'],
  allergies: [],
  pregnant: false,
  surgeryWithin1Month: false,
  injuryWithin48h: false,
  bp: { sys: 148, dia: 92 },
  bpSymptoms: false,
  temperature: 36.6,
  pulse: 78,
  flags: { dvt: false, openWoundOrSkinInfection: false, unhealedFracture: false, cancerSite: false, acuteInfection: false },
  symptoms: { suddenNumbnessOrWeakness: false, slurredSpeechOrFacialDroop: false, chestTightOrBreathless: false, unilateralCalfSwelling: false },
};

const redFlagProfile: HealthProfile = {
  ...baseProfile,
  bp: { sys: 186, dia: 112 },
  symptoms: { ...baseProfile.symptoms, suddenNumbnessOrWeakness: true },
};

export type Scenario = 'caution' | 'redflag';

/** คนไข้ใหม่เดินไปถึงขั้นไหน: ยังไม่ทำอะไร → ประเมินกับ AI แล้ว → จองแล้ว → รับบริการแล้ว (ติดตามผล) */
export type CareStage = 'new' | 'assessed' | 'booked' | 'served';
/** นัดที่จอง */
export interface Booking {
  date: string;
  time: string;
  service: string;
  therapist: string;
  clinic: string;
  /** เลขคิว (ออกเฉพาะนัดวันนี้) */
  queue?: string;
  /** ครั้งที่เท่าไหร่ของคอร์ส */
  visit: number;
  /** จองจากแอป = คำขอจอง รอเจ้าหน้าที่คลินิกยืนยัน (หลังบ้าน: คำขอจองคิว) · ไม่ระบุ = ยืนยันแล้ว */
  status?: 'pending' | 'confirmed';
  /** ที่คลินิกวันนี้ (cloud): เช็กอินแล้ว · ถึงคิว · กำลังรับบริการ */
  stage?: 'checked_in' | 'called' | 'in_service';
  /** เวลาที่คลินิกเริ่มรับบริการ (ISO) → เวลาที่นวดไปแล้ว · เสร็จประมาณ */
  startedAt?: string;
  /** ระยะเวลาบริการตามนัดในคลินิก (นาที) */
  minutes?: number;
  /** นัดที่คลินิกลงให้ตามคอร์ส: ชื่อคอร์ส · ครั้งที่ · วันที่ ISO (เรียงรายการนัด) */
  course?: { name: string; no: number; total: number };
  iso?: string;
}
export type LooseBooking = Booking & { id: string };
/** สรุปจากการประเมินกับ AI (ใช้ต่อในหน้าจอง / หน้าแรก / ผู้ให้บริการ) */
export interface AssessSummary {
  symptoms: string[];
  pain: number;
  cause?: string;
  caution?: string;
  red: boolean;
}

/**
 * ใบร่าง — เกิดจากการประเมินกับ AI (ยังไม่มีการรักษา) · ใช้ช่อง bento เดียวกับใบการรักษา
 * ประเมินซ้ำเรื่องเดิม = อัปเดตใบเดิม · อาการใหม่ = ใบใหม่ · นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค → ใบจริง
 */
export interface DraftCase {
  id: string;
  /** ชื่อแท็บ = อาการที่เล่า */
  title: string;
  symptoms: string[];
  pain: number;
  /** คะแนนจากการประเมินครั้งก่อน (ประเมินซ้ำเรื่องเดิม) */
  prevPain?: number;
  duration?: string;
  cause?: string;
  caution?: string;
  red: boolean;
  stage: 'assessed' | 'booked' | 'served';
  booking?: Booking;
  /** คะแนนปวดหลังนวด */
  after?: number;
  /** แชทของเรื่องนี้ (ประเมินซ้ำต่อในแชทเดิม) */
  chatId?: string;
  /** คำตอบโรคประจำตัว/ยาครั้งก่อน (ประเมินซ้ำไม่ต้องถามใหม่) */
  health?: string;
  meds?: string;
  allergy?: string;
  /** ข้อห้ามนวด / แรงนวดที่ตอบไว้ (ประเมินซ้ำไม่ต้องถามใหม่) */
  risk?: string;
  pressure?: string;
  /** บริเวณที่ไม่ต้องการให้นวด */
  avoid?: string;
  /** แนวทางที่ AI แนะนำ (จากการ์ดแนวทางในแชท) — ยังไม่ใช่แผนของแพทย์ */
  guide?: { condition?: string; methods: string[]; points?: string[]; caution?: string; /** หลายบริเวณ (แรก = บริเวณหลัก) */ areas?: { symptom: string; region?: string; symptoms?: string[]; condition: string; points: string[] }[] };
  /** บริเวณหลัก (ปวดมากที่สุด) เมื่อปวดหลายบริเวณ */
  primary?: string;
  /** ปวดหลายบริเวณแต่ยังไม่ได้เลือกบริเวณหลัก (ออกจากแชทก่อนตอบ) — ไม่เดาให้ */
  primaryPending?: boolean;
  /** ผลประเมินรอบก่อน ๆ (ประเมินซ้ำ = รอบใหม่ ไม่ลบของเดิม) — at = วันเวลาที่ประเมินรอบนั้นถูกแทน */
  history?: { at: string; pain: number; symptoms: string[]; caution?: string }[];
  /** วันที่ประเมิน (ISO) · วันที่ยืนยันอาการก่อนนัด (ISO) — ประเมินไว้นานก่อนนัด → ยืนยันอีกครั้งก่อนนวด */
  assessedOn?: string;
  confirmedOn?: string;
  radiate?: string;
  /** อาการร่วมที่ตอบไว้ (ชา อ่อนแรง …) */
  related?: string[];
  /** ผู้ใช้เลือกคงบริการที่จองไว้ แม้ไม่ตรงผลประเมิน (ไม่บังคับเปลี่ยน · ไม่เตือนซ้ำ) */
  keepService?: boolean;
}

/**
 * ใบร่าง → ใบการรักษา หลังนวดครั้งแรก
 * ⚠️ ต้นแบบ: ชื่อโรคจำลองว่าผู้ให้บริการตั้งให้ (ลมปลายปัตฆาต = รหัสโรคแผนไทยที่พบบ่อยของคอ/บ่า/หลัง, health profile 2568 หน้า 13)
 */
const DIAGNOSIS: Record<string, string> = {
  'ปวดคอ-บ่า': 'ลมปลายปัตฆาตสัญญาณ 4 หลัง/คอ',
  ปวดขา: 'ลมปลายปัตฆาตขา',
  ปวดคอ: 'ลมปลายปัตฆาต สัญญาณ 4 (คอ)',
  ปวดหลัง: 'ลมปลายปัตฆาต สัญญาณ 3 (หลัง)',
  ปวดไหล่: 'ลมปลายปัตฆาต (ไหล่)',
};
function draftToCase(d: DraftCase, painAfter: number, diagnosis?: string): TreatmentCase {
  const areas = d.symptoms.flatMap((sym) => (CHIP_PINS[sym] ?? []).slice(0, 1).map((pin) => ({ label: sym.replace('ปวด', ''), pin, symptom: sym, before: d.pain })));
  const visit = d.booking?.date ?? 'วันนี้';
  return {
    id: `case-${d.id}`,
    // ชื่อโรคจากผู้ให้บริการจริง (cloud) ถ้ามี · ไม่มี = จำลอง
    condition: diagnosis ?? DIAGNOSIS[d.symptoms[0]] ?? guideFor(d.symptoms).condition,
    short: d.title,
    plan: 'นวดราชสำนัก',
    areas,
    visits: [{ date: visit, painBefore: d.pain, painAfter }],
    // ติดตามอาการหลังนวดครั้งแรก (โหมด focus บนหุ่น)
    pending: [{ id: `sess-${d.id}`, date: visit, plan: 'นวดราชสำนัก', areas }],
    // รักษาต่อที่เดิมเท่านั้น
    clinic: d.booking?.clinic,
    // นัดครั้งถัดไปยังไม่ได้จอง (ไม่สร้างนัดขึ้นเอง) → การ์ดนัดขึ้น "จองนัด"
    appointment: { today: false, date: '-', time: '-' },
    prep: d.caution?.includes('ความดัน') || d.caution?.includes('อบ') ? ['วัดความดันก่อนนวด', 'งดอาหารหนัก 30 นาที'] : ['งดอาหารหนัก 30 นาที'],
    course: { done: 1, total: 6 },
    therapist: d.booking?.therapist ?? 'พท.ป. วิภาวดี ศรีสุข',
    selfCare: (() => {
      // ท่าตามบริเวณที่ปวด (7 กลุ่มอาการ) · ไม่มีท่าที่ตรง → หน้ารวมท่า
      const groupId = stretchGroupFor(d.symptoms);
      const g = SYMPTOM_GROUPS.find((x) => x.id === groupId);
      return { title: g ? g.stretch.name.replace(' 7 ท่า', '') : 'ดูท่ายืดทั้งหมด', minutes: 5, doneToday: false, groupId };
    })(),
    chatId: d.chatId,
  };
}

/** ช่องทางเข้าสู่ระบบ — แต่ละช่องทางได้ข้อมูลมาไม่เท่ากัน */
export type AuthProvider = 'healthid' | 'google' | 'line' | 'email';
/** บัญชีที่สมัครในต้นแบบ (null = ใช้คนไข้ตัวอย่างที่มีประวัติการรักษาแล้ว) */
export interface Account {
  provider: AuthProvider;
  name: string;
  birthDate: string;
  sex: string;
  /** ยืนยันตัวตนแล้ว (บัตรประชาชน) */
  verified: boolean;
  /** บัญชีจริง (Supabase Auth) */
  userId?: string;
  email?: string;
  /** ข้อมูลตามบัตรประชาชน + เบอร์โทร */
  idCard?: IdCard;
  /** avatar ที่เลือก ("avatar:p12") · ไม่มี = ตามเพศ */
  avatar?: string;
}

interface JourneyState {
  client: { name: string; initials: string; age: number; occupation: string; hn: string };
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  consents: Consents;
  setConsents: (c: Consents) => void;
  profile: HealthProfile;
  setProfile: (p: HealthProfile) => void;
  symptoms: Partial<Record<RegionId, number>>;
  setSymptoms: (s: Partial<Record<RegionId, number>>) => void;
  chiefComplaint: string;
  setChiefComplaint: (s: string) => void;
  goal: string;
  setGoal: (s: string) => void;
  before: Assessment;
  setBefore: (a: Assessment) => void;
  after?: Assessment;
  setAfter: (a: Assessment) => void;
  safety: SafetyResult;
  acknowledged: string[];
  setAcknowledged: (ids: string[]) => void;
  record: ServiceRecord;
  setRecord: (r: ServiceRecord) => void;
  /** ธาตุเจ้าเรือนปัจจุบัน (% ต่อธาตุ) */
  elements: Record<ElementKey, number>;
  setElements: (e: Record<ElementKey, number>) => void;
  elementsDone: boolean;
  audit: AuditEntry[];
  log: (actor: string, action: string) => void;
  /** ผลติดตามอาการที่ส่งไปหลังบ้านแล้ว (ล่าสุดอยู่หน้า) */
  followUps: FollowUpRecord[];
  /** ส่งผลติดตามอาการ → บันทึกเมื่อหลังบ้านรับแล้ว */
  sendFollowUp: (p: Omit<FollowUpPayload, 'hn' | 'channel'>) => Promise<FollowUpRecord>;
  reset: () => void;
  /** บัญชีที่สมัครใหม่ (null = คนไข้ตัวอย่างเดิม) */
  account: Account | null;
  setAccount: (a: Account | null) => void;
  /** ยังไม่มีข้อมูลการรักษา → หน้าแรกแบบเริ่มต้นใช้งาน */
  newPatient: boolean;
  setNewPatient: (v: boolean) => void;
  careStage: CareStage;
  setCareStage: (s: CareStage) => void;
  /** นัดเรื่องใหม่ที่จองไว้ก่อนประเมิน (ยังไม่ผูกกับเรื่องไหน) — มีได้หลายนัด */
  looseBookings: LooseBooking[];
  addLooseBooking: (b: Booking) => string;
  updateLooseBooking: (id: string, b: Booking) => void;
  removeLooseBooking: (id: string) => void;
  lastAssess: AssessSummary | null;
  setLastAssess: (a: AssessSummary | null) => void;
  drafts: DraftCase[];
  /** เพิ่มใบใหม่ หรือแก้ใบเดิม (id ตรงกัน) */
  upsertDraft: (d: DraftCase) => void;
  /** ลบใบร่าง (เช่น รวมเข้าเรื่องเดิม) */
  removeDraft: (id: string) => void;
  /** ใบร่างที่กำลังจอง/รับบริการ */
  activeDraftId: string | null;
  setActiveDraftId: (id: string | null) => void;
  /** ใบการรักษาที่เกิดจากใบร่าง (นวดครั้งแรกแล้ว ผู้ให้บริการตั้งชื่อโรค) */
  promoted: TreatmentCase[];
  /** นัดของใบการรักษาที่ผู้ใช้ยกเลิกแล้ว (case id) — หน้าแรกเปลี่ยนเป็น "ยังไม่มีนัด" */
  cancelledAppts: string[];
  cancelAppointment: (caseId: string) => void;
  /** นัดของใบการรักษาที่จอง/เลื่อนใหม่ (แทนนัดตัวอย่าง) · ต้นแบบ: เก็บในเครื่อง */
  caseAppts: Record<string, CaseAppt>;
  /** นัดที่คลินิกลงไว้ล่วงหน้าตามแผนการรักษา (เรียงตามวัน · ครั้งแรก = นัดครั้งถัดไปของเรื่องนั้น) */
  plannedVisits: Record<string, PlannedVisit[]>;
  setCaseAppointment: (caseId: string, appt: CaseAppt) => void;
  /** นวดครั้งแรกเสร็จ → ใบร่างกลายเป็นใบการรักษา (ชื่อแท็บเดิม · ชื่อโรคจากผู้ให้บริการ — ส่งมาจริงได้ผ่าน cloud) */
  promoteDraft: (draftId: string, painAfter: number, diagnosis?: string) => void;
  /** ออกจากระบบ: ล้างบัญชีและข้อมูลของรอบนี้ทั้งหมด */
  /** เปิดแอปแล้วมีข้อมูลที่บันทึกไว้ (เคยเข้าใช้งาน) → ข้ามหน้าเข้าสู่ระบบ */
  resumed: boolean;
  /** ถึงหน้าแรกแล้ว → เริ่มจำข้อมูลข้ามการเปิดแอปใหม่ */
  markEntered: () => void;
  /** ออกจากระบบ (ล้างข้อมูลในแอป) · localOnly = ล้างในแอปอย่างเดียว ไม่ออกจากบัญชี */
  signOut: (localOnly?: boolean) => void;
  /**
   * ใบการรักษาที่ใช้แสดงทุกหน้า (หน้าแรก · ประวัติ · โปรไฟล์ · นัด · AI) — ตัวอย่าง + ใบจากใบร่าง
   * รวมนัดที่จอง/เลื่อน · นัดที่ยกเลิก (= ไม่มีนัด) · ครั้งที่นวดเพิ่ม → ทุกหน้าเห็นข้อมูลชุดเดียวกัน
   */
  cases: TreatmentCase[];
  /** นวดครั้งนี้ของใบการรักษาเสร็จ → เพิ่มครั้งการรักษา · นับคอร์ส · นัดนี้ใช้ไปแล้ว */
  recordCaseVisit: (caseId: string, painBefore: number, painAfter: number) => void;
  /**
   * คลินิกปิดการรักษาครั้งนี้ในหลังบ้าน (เช็กเอาต์/ออกบิล) → แอปได้ครั้งใหม่ + คะแนนหลังนวดของคลินิก + บิล
   * ไม่ขึ้นกับว่าผู้ใช้กรอกแบบประเมินหลังนวดหรือไม่ · คืน id ใบการรักษา
   * ⚠️ ต้นแบบ: จำลองคะแนนของคลินิก + แจ้งเตือนติดตามผลวันถัดไป (มาหลังจากนี้ไม่กี่วินาที)
   */
  clinicCloseVisit: (target: { caseId?: string; draftId?: string }, clinicPainAfter?: number, opts?: CloseOpts) => string | undefined;
  /** แจ้งหลังบ้านคลินิก (เมื่อเปิดอยู่ในเบราว์เซอร์เดียวกัน — ต้นแบบ) */
  notifyClinic: (title: string, body: string) => void;
  /** ความรู้สึกหลังนวดที่ผู้ใช้บอกเอง (ครั้งล่าสุด) — แสดงคู่กับคะแนนของคลินิก */
  setVisitSelfPain: (caseId: string, pain: number) => void;
  /** ออกเลขคิว (เฉพาะนัดวันนี้) */
  issueQueue: () => string;
  /**
   * อาการล่าสุดก่อนนวดครั้งถัดไปของแต่ละเรื่อง (ประเมินก่อนนวด / อัปเดตอาการ) — ผู้ให้บริการเห็นก่อนถึงคิว
   * ใช้เป็นคะแนน "ก่อน" ของครั้งที่จะนวด · นวดเสร็จแล้วล้าง (รอบหน้าประเมินใหม่)
   */
  caseToday: Record<string, CaseToday>;
  setCaseToday: (caseId: string, v: CaseToday) => void;
  /** หลังเช็กอิน: แจ้งอาการเพิ่ม → แปะกับนัดนั้นในคลินิก (ไม่แก้ผลประเมิน) · หานัดไม่เจอ = ส่งเป็นข้อความถึงคลินิก */
  addSymptomNote: (target: { caseId?: string; draftId?: string; looseId?: string }, title: string, text: string) => void;
  /** แจ้งเตือนจากคลินิก: เลื่อน/ยกเลิกนัดของการรักษา (ผู้ใช้เปลี่ยนเองไม่ได้ — หลังบ้านโรงพยาบาลแก้แล้วแจ้งมา) */
  apptNotices: ApptNotice[];
  /** อ่านแล้ว (ยังอยู่ในรายการ) */
  dismissNotice: (id: string) => void;
  markAllNoticesRead: () => void;
  /** บิล/ใบเสร็จจากคลินิก (หลังบ้านส่งบิลมาให้จ่ายในแอป · จ่ายแล้วได้ใบเสร็จ) */
  bills: Bill[];
  /** คอร์สการรักษาที่คลินิกเปิดให้ (บัญชีจริง) */
  clinicCourse: ClinicCourse | null;
  /** ประวัติการรักษาที่คลินิกบันทึก (ล่าสุดก่อน) */
  clinicVisits: ClinicVisit[];
  payBill: (id: string) => void;
  /** ส่งคำขอจองไปคลินิก (ต้นแบบ: จำลองว่าเจ้าหน้าที่ยืนยันหลังไม่กี่วินาที แล้วแจ้งเตือนในแอป) */
  requestBooking: (target: { draftId?: string; looseId?: string }, label: string) => void;
  /** จอง/เลื่อนนัดครั้งถัดไปของเรื่องที่รักษาอยู่ · cloud = ส่งเป็นคำขอจองไปคลินิก (รอยืนยัน · เลขคิวได้ตอนเช็กอิน) */
  bookCase: (caseId: string, appt: CaseAppt, service: string) => void;
  /** เช็กอินที่คลินิก — นัดที่จองผ่าน cloud: คลินิกออกเลขคิวแล้วส่งกลับมา */
  /** เช็กอินที่คลินิกด้วยรหัสจาก QR ที่เคาน์เตอร์ → คลินิกตรวจแล้วออกเลขคิว · false = ส่งไม่สำเร็จ */
  checkIn: (target: { draftId?: string; looseId?: string; caseId?: string }, code?: string) => Promise<boolean>;
  /** เช็กอินไม่ผ่าน (cloud ref → เหตุผล) */
  checkinErrors: Record<string, string>;
  /** ยกเลิกนัดที่ส่งไปคลินิกแล้ว (แจ้งหลังบ้าน) */
  cancelBooking: (target: { draftId?: string; looseId?: string }) => void;
  /** นัดนี้เชื่อมกับหลังบ้านผ่าน cloud (คลินิกเป็นคนปิดการรักษา/ออกบิล — ไม่ต้องจำลอง) · คืน id ใน cloud */
  cloudRefOf: (target: { draftId?: string; looseId?: string; caseId?: string }) => string | undefined;
}

/** คำขอจองที่ส่งไปหลังบ้าน → เรื่องไหนในแอป (+ ใบการรักษาที่เกิดหลังนวดเสร็จ สำหรับบิล/ใบเสร็จที่ตามมา) */
/** ปิดการรักษาจากคลินิก: bill=false ไม่จำลองบิล · record = บันทึกการรักษาจริงจากหลังบ้าน */
type CloseOpts = { bill?: boolean; diagnosis?: string; record?: TreatmentCase['visits'][number]['record'] };
/** caseBooking = นัดครั้งถัดไปของเรื่องที่รักษาอยู่ (จองในแอป → ส่งเป็นคำขอจองไปคลินิกเหมือนนัดใหม่) */
type BridgeRef = { draftId?: string; looseId?: string; label: string; patientId?: string; caseId?: string; title?: string; caseBooking?: boolean; billId?: string; done?: boolean; /** คลินิกลงนัดให้ตามคอร์ส */ course?: boolean };

export interface Bill {
  id: string;
  caseId?: string;
  title: string;
  /** วันที่รับบริการ */
  date: string;
  items: { name: string; amount: number }[];
  total: number;
  status: 'pending' | 'paid';
  /** เลขใบเสร็จที่คลินิกออก (มากับบิล → จ่ายในแอปได้เลขเดียวกับคลินิก) */
  receiptNo?: string;
  paidAt?: string;
  /** นัดใน cloud ที่บิลนี้มาจาก (จ่ายในแอปแล้วแจ้งคลินิก) */
  cloudRef?: string;
  /** วิธีชำระ: app = จ่ายในแอป · cash / promptpay = จ่ายที่เคาน์เตอร์ · credit = หักเครดิตคอร์ส */
  method?: 'app' | 'cash' | 'promptpay' | 'credit';
  /** ผู้บำบัดของครั้งนั้น (แสดงในใบเสร็จ) */
  therapist?: string;
}
/** วิธีชำระจากหลังบ้าน → ชุดที่แอปรู้จัก */
const asMethod = (m?: string): Bill['method'] => (m === 'app' || m === 'cash' || m === 'promptpay' || m === 'credit' ? m : undefined);
const SAMPLE_BILLS: Bill[] = [
  // บิลนี้อยู่ในหลังบ้านด้วย (cloud) → จ่ายในแอปแล้วคลินิกเห็นทันที
  { id: 'b-lung-3', caseId: 'case-lung', title: 'รักษาภูมิแพ้ ครั้งที่ 3', date: '16 ส.ค.', items: [{ name: 'นวดหน้า ศีรษะ ไหล่', amount: 350 }, { name: 'ลูกประคบสมุนไพร', amount: 50 }], total: 400, status: 'pending', cloudRef: 'tw-demo-lung-3' },
  { id: 'b-office-5', caseId: 'case-office', title: 'รักษาออฟฟิศซินโดรม ครั้งที่ 5', date: '30 ส.ค.', items: [{ name: 'นวดไทยเพื่อการรักษา', amount: 450 }], total: 450, status: 'paid', receiptNo: 'RC2569-000123', paidAt: '30 ส.ค. 12:20', method: 'cash' },
];

export interface ApptNotice {
  id: string;
  /** แจ้งเตือนของเรื่องไหน (ใบการรักษา / ใบร่าง / นัดเรื่องใหม่) */
  caseId?: string;
  draftId?: string;
  looseId?: string;
  /**
   * จากหลังบ้านคลินิก: moved เลื่อนนัด · cancelled ยกเลิกนัด · confirmed ยืนยันนัด · rejected ปฏิเสธคำขอจอง · reminder เตือนก่อนถึงนัด
   * noshow ไม่มาตามนัด · waitlist มีคิวว่าง · bill บิลรอชำระ · receipt ใบเสร็จ · followup ชวนอัปเดตอาการหลังนวด
   */
  kind: 'moved' | 'cancelled' | 'confirmed' | 'rejected' | 'reminder' | 'noshow' | 'waitlist' | 'bill' | 'receipt' | 'followup';
  /** บิล/ใบเสร็จที่เกี่ยวข้อง */
  billId?: string;
  text: string;
  /** เวลาที่คลินิกแจ้ง */
  at: string;
  read?: boolean;
}
/** ตัวอย่าง: คลินิกเลื่อนนัดรักษาภูมิแพ้ (ข้อมูลจริงมาจากหลังบ้าน ThaiWellAI เมื่อเจ้าหน้าที่ "ยืนยันนัดใหม่" / "ยกเลิกนัด") */
const SAMPLE_NOTICES: ApptNotice[] = [
  { id: 'n-lung-bill', caseId: 'case-lung', kind: 'bill', billId: 'b-lung-3', text: 'บิลรักษาภูมิแพ้ ครั้งที่ 3 รอชำระ 400 บาท', at: '16 ส.ค. 15:10' },
  { id: 'n-office-reminder', caseId: 'case-office', kind: 'reminder', text: 'วันนี้มีนัดรักษาออฟฟิศซินโดรม ครั้งที่ 6 อย่าลืมประเมินก่อนนวด', at: 'วันนี้ 07:00' },
  { id: 'n-office-confirmed', caseId: 'case-office', kind: 'confirmed', text: 'คลินิกยืนยันนัดรักษาออฟฟิศซินโดรม ครั้งที่ 6 วันนี้', at: 'เมื่อวาน 17:40', read: true },
  { id: 'n-office-receipt', caseId: 'case-office', kind: 'receipt', billId: 'b-office-5', text: 'ใบเสร็จรักษาออฟฟิศซินโดรม ครั้งที่ 5 · 450 บาท', at: '30 ส.ค. 12:20', read: true },
];

export interface CaseToday {
  pain: number;
  /** อาการหลังนวดครั้งก่อน (ไม่มี / ระบม / ปวดมากขึ้น / ชา-อ่อนแรง) */
  adverse?: string;
  /** ข้อห้ามใหม่ก่อนนวด (ไม่มี / มีไข้ / บาดเจ็บภายใน 2 วัน / เริ่มยาใหม่) */
  risk?: string;
  /** ควรพบแพทย์ก่อนนวดครั้งถัดไป */
  red?: boolean;
}

/** นัดของใบการรักษา (จองในแชท) */
/** นัดตามแผนที่คลินิกลงเอง (แถวใน cloud ที่ไม่ได้จองจากแอป) */
export interface PlannedVisit {
  id: string;
  /** ป้ายวันแบบในแอป (วันนี้ · พรุ่งนี้ · จ. 12 ต.ค.) */
  date: string;
  iso: string;
  time: string;
  therapist: string;
}
export interface CaseAppt {
  today: boolean;
  date: string;
  time: string;
  queue?: string;
  clinic: string;
  therapist: string;
  stage?: 'checked_in' | 'called' | 'in_service';
  /** เวลาที่คลินิกเริ่มรับบริการ (ISO) */
  startedAt?: string;
  /** ระยะเวลาบริการตามนัดในคลินิก (นาที) */
  minutes?: number;
}

/** แนวทางการรักษาจากผลประเมินของใบร่าง (ส่งให้คลินิก) · ไม่มีอาการ / ควรพบแพทย์ = ไม่มีแนวทาง */
const guideOfDraft = (d?: DraftCase) => {
  if (!d || d.red || !d.symptoms.length) return undefined;
  const g = guideFor(d.symptoms, d.radiate);
  return { condition: g.condition, methods: g.methods, points: g.points, caution: [d.caution, g.caution].filter(Boolean).join('\n') || undefined, ref: g.ref };
};

const Ctx = createContext<JourneyState | null>(null);

/* ---------- จำข้อมูลแอปข้ามการเปิดใหม่ (เว็บ + มือถือ · ต้นแบบ) ----------
 * เก็บบัญชี การจอง เรื่องที่รักษา นัด แจ้งเตือน บิล และคำขอที่ส่งไปหลังบ้าน → เปิดใหม่ยังรับข้อมูลจากคลินิกต่อได้
 * ออกจากระบบ = ล้างทั้งหมด */
export const APP_STATE_KEY = 'thaiwell.app.v1';
/** แชทกับ AI (ประวัติการประเมิน/คำตอบ) + แชทของแต่ละเรื่อง — บันทึกที่หน้าแรก */
export const CHATS_KEY = 'thaiwell.chats.v1';
/** อ่านครั้งแรกตอนสร้าง provider (มือถือโหลดเข้าหน่วยความจำไว้แล้ว — App.tsx) */
let SAVED: Record<string, unknown> | null | undefined;
const savedState = () => {
  if (SAVED === undefined) {
    try {
      const raw = getItem(APP_STATE_KEY);
      SAVED = raw ? JSON.parse(raw) : null;
    } catch {
      SAVED = null;
    }
  }
  return SAVED;
};
const saved = <T,>(key: string, fallback: T): T => {
  const sv = savedState();
  return sv?.entered && sv[key] !== undefined ? (sv[key] as T) : fallback;
};

const initialBefore: Assessment = { pain: 3, stiffness: 7, mobility: 2, stress: 4, sleep: 2 };
const initialRecord: ServiceRecord = { regions: [], techniques: [], pressure: 'ปานกลาง', duration: 60, notes: '', provider: 'พท.ป. สมศรี ดีงาม' };

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [scenario, setScenarioState] = useState<Scenario>('caution');
  const [profile, setProfile] = useState<HealthProfile>(() => saved('profile', baseProfile));
  const [consents, setConsents] = useState<Consents>(() => saved('consents', { service: false, aiProcessing: false, followUp: true, research: false }));
  const [symptoms, setSymptoms] = useState<Partial<Record<RegionId, number>>>({ shoulder_r: 6, neck: 4, upper_back: 3 });
  const [chiefComplaint, setChiefComplaint] = useState('ปวดตึงคอ–บ่าขวา หลังทำงานหน้าคอมพิวเตอร์');
  const [goal, setGoal] = useState('ลดปวด และคลายตึง');
  const [before, setBefore] = useState<Assessment>(initialBefore);
  const [after, setAfter] = useState<Assessment | undefined>();
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [record, setRecord] = useState<ServiceRecord>(initialRecord);
  const [elements, setElementsState] = useState<Record<ElementKey, number>>(() => saved('elements', { ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 }));
  /** ทำแบบประเมินธาตุแล้ว (คนใหม่ยังไม่ทำ = ใช้ธาตุเจ้าเรือนจากวันเกิด ไม่ใช้ค่าตัวอย่าง) */
  const [elementsDone, setElementsDone] = useState(() => saved('elementsDone', false));
  const setElements = useCallback((e: Record<ElementKey, number>) => {
    setElementsState(e);
    setElementsDone(true);
  }, []);
  const [audit, setAudit] = useState<AuditEntry[]>([
    { at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' },
  ]);

  const [followUps, setFollowUps] = useState<FollowUpRecord[]>(() => saved('followUps', []));
  const [account, setAccount] = useState<Account | null>(() => saved('account', null));
  const [newPatient, setNewPatient] = useState(() => saved('newPatient', false));
  /** เปลี่ยนทุกครั้งที่เริ่มบัญชีใหม่ (ออกจากระบบ / ดูคนไข้ตัวอย่าง) → ผูกข้อมูลกับคลินิกใหม่ */
  const [session, setSession] = useState(0);
  const [careStage, setCareStage] = useState<CareStage>(() => saved('careStage', 'new'));
  const [looseBookings, setLooseBookings] = useState<LooseBooking[]>(() => saved('looseBookings', []));
  const addLooseBooking = useCallback((b: Booking) => {
    const id = `nb${Date.now()}`;
    setLooseBookings((all) => [...all, { ...b, id }]);
    return id;
  }, []);
  const updateLooseBooking = useCallback((id: string, b: Booking) => setLooseBookings((all) => all.map((x) => (x.id === id ? { ...b, id } : x))), []);
  const removeLooseBooking = useCallback((id: string) => setLooseBookings((all) => all.filter((x) => x.id !== id)), []);
  const [lastAssess, setLastAssess] = useState<AssessSummary | null>(() => saved('lastAssess', null));
  const [drafts, setDrafts] = useState<DraftCase[]>(() => saved('drafts', []));
  const [activeDraftId, setActiveDraftId] = useState<string | null>(() => saved('activeDraftId', null));
  const [promoted, setPromoted] = useState<TreatmentCase[]>(() => saved('promoted', []));
  const promotedRef = React.useRef(promoted);
  promotedRef.current = promoted;
  const [cancelledAppts, setCancelledAppts] = useState<string[]>(() => saved('cancelledAppts', []));
  const cancelAppointment = useCallback((caseId: string) => setCancelledAppts((ids) => (ids.includes(caseId) ? ids : [...ids, caseId])), []);
  const [caseAppts, setCaseAppts] = useState<Record<string, CaseAppt>>(() => saved('caseAppts', {}));
  // จองใหม่ → ไม่ถือว่ายกเลิกแล้ว
  const courseOfRows = (): ClinicCourse | null => {
    if (!isCloud() || !account?.userId) return null;
    const me = patientOf().id;
    const cs = clinicMadeRows()
      .filter((r) => r.patient_id === me)
      .map((r) => ({ r, c: (r as CloudRow & { assessment?: { course?: { name: string; no: number; total: number } } }).assessment?.course }))
      .filter((x): x is { r: CloudRow; c: { name: string; no: number; total: number } } => !!x.c)
      .sort((a, b) => a.c.no - b.c.no);
    if (!cs.length) return null;
    const { r, c } = cs[0];
    return { name: c.name, service: r.service ?? c.name, total: c.total, used: Math.max(0, c.no - 1), startedOn: '', expiresOn: '' };
  };
  /** สถานะวันนัดจากแถวในคลินิก (เช็กอิน · เรียกคิว · กำลังรับบริการ + เวลาเริ่ม) */
  const stageOfRow = (r: CloudRow): Pick<CaseAppt, 'stage' | 'startedAt'> =>
    r.status === 'in_service' ? { stage: 'in_service', startedAt: r.updated_at } : r.status === 'called' ? { stage: 'called' } : r.status === 'checked_in' ? { stage: 'checked_in' } : {};
  const setCaseAppointment = useCallback((caseId: string, appt: CaseAppt) => {
    // เวลาเริ่มรับบริการ: ใช้ค่าแรกที่ได้ (แถวในคลินิกอัปเดตระหว่างนวด เวลาแก้ไขล่าสุดจะเลื่อน)
    // นัดเดิม (วัน-เวลาเดียวกัน) → คงสถานะที่คลินิก (เช็กอิน · เรียกคิว · กำลังรับบริการ + เวลาเริ่ม) ไว้ ไม่ให้การดึงนัดซ้ำล้างทิ้ง
    setCaseAppts((m) => {
      const cur = m[caseId];
      const same = cur && cur.date === appt.date && cur.time === appt.time;
      return { ...m, [caseId]: same ? { ...appt, queue: appt.queue ?? cur.queue, stage: appt.stage ?? cur.stage, startedAt: (cur.stage === 'in_service' && cur.startedAt) || appt.startedAt } : appt };
    });
    setCancelledAppts((ids) => ids.filter((x) => x !== caseId));
  }, []);
  /** ครั้งที่นวดเพิ่มของใบการรักษา (ต่อท้าย visits เดิม) */
  const [caseVisits, setCaseVisits] = useState<Record<string, TreatmentCase['visits']>>(() => saved('caseVisits', {}));
  /** คะแนนหลังนวดที่ผู้ใช้ประเมินเอง: ครั้งที่ n ของแต่ละเรื่อง */
  const [selfPains, setSelfPains] = useState<Record<string, { n: number; v: number }>>(() => saved('selfPains', {}));
  /** บันทึกการรักษาจริงจากคลินิก: "caseId:ลำดับครั้ง" */
  const [visitRecords, setVisitRecords] = useState<Record<string, NonNullable<CloseOpts['record']>>>(() => saved('visitRecords', {}));
  const queueNo = React.useRef(saved('queueNo', 11));
  const clinicHnRef = React.useRef<string | null>(null);
  const [clinicCourse, setClinicCourse] = useState<ClinicCourse | null>(null);
  const [clinicVisits, setClinicVisits] = useState<ClinicVisit[]>([]);
  /** หลังบ้านสั่งล้างข้อมูลของผู้ป่วยนี้ล่าสุดเมื่อไร · resetSeen = ล้างตามไปแล้วถึงครั้งไหน (เก็บกับบัญชี) */
  const [clinicReset, setClinicReset] = useState<{ at: string; all: boolean } | null>(null);
  const resetSeen = React.useRef<string | null>(null);
  /** อ่านคอร์สจากคลินิกใหม่ (คลินิกลงนัด/นวดเสร็จ → จำนวนครั้งที่ใช้เปลี่ยน) */
  const refreshCourse = useCallback(() => {
    const id = latest.current.account?.userId;
    if (id && isCloud())
      void fetchMyCourse(id)
        .then((r) => {
          setClinicCourse(r.course);
          setClinicVisits(r.visits);
          setClinicReset(r.reset);
        })
        .catch(() => undefined);
  }, []);
  const casesRef = React.useRef<TreatmentCase[]>([]);
  const issueQueue = useCallback(() => `A${++queueNo.current}`, []);
  const [caseToday, setCaseTodayState] = useState<Record<string, CaseToday>>(() => saved('caseToday', {}));
  const [apptNotices, setApptNotices] = useState<ApptNotice[]>(() => saved('apptNotices', SAMPLE_NOTICES));
  const dismissNotice = useCallback((id: string) => setApptNotices((all) => all.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllNoticesRead = useCallback(() => setApptNotices((all) => all.map((n) => ({ ...n, read: true }))), []);
  const [bills, setBills] = useState<Bill[]>(() => saved('bills', SAMPLE_BILLS));
  /* ---------- สะพานไปหลังบ้าน (ต้นแบบ) ---------- */
  const latest = React.useRef({ drafts, looseBookings, account, profile, bills });
  latest.current = { drafts, looseBookings, account, profile, bills };
  /** คำขอจองที่ส่งไปหลังบ้าน → เรื่องไหนในแอป */
  const bridgeRefs = React.useRef<Record<string, BridgeRef>>(saved('bridgeRefs', {}));
  /** ผู้ป่วยในหลังบ้าน → เรื่องที่รักษาในแอป (เกิดตอนนวดครั้งแรกเสร็จ) · แผนที่มาก่อนมีเรื่อง → เก็บไว้ใช้ทีหลัง */
  const bridgedCase = React.useRef<Record<string, string>>(saved('bridgedCase', {}));
  const pendingPlan = React.useRef<Record<string, Extract<ClinicEvent, { type: 'plan' }>>>(saved('pendingPlan', {}));
  /** บัญชีตัวอย่าง: นัด/บิลของใบการรักษาที่อยู่ใน cloud ร่วมกับหลังบ้าน (DEMO_LINKS) · done = คลินิกบันทึกการนวดแล้ว */
  const caseLinks = React.useRef<Record<string, { caseId: string; billId?: string; done?: boolean; title?: string; /** นัดที่คลินิกลงเองตามแผน */ planned?: boolean }>>({});
  const [plannedVisits, setPlannedVisits] = useState<Record<string, PlannedVisit[]>>(() => saved('plannedVisits', {}));
  const patientOf = (): ClinicPatient => {
    const { account: acc, profile: pf } = latest.current;
    // บัญชีจริง: id = user id ของบัญชี · ชื่อ/เพศ/เบอร์ ตามบัตรประชาชน
    if (acc?.userId) {
      const c = acc.idCard;
      return {
        id: acc.userId,
        hn: `APP-${acc.userId.slice(0, 6).toUpperCase()}`,
        name: c ? `${c.title}${c.firstName} ${c.lastName}` : `คุณ${acc.name}`,
        gender: acc.sex === 'หญิง' ? 'หญิง' : 'ชาย',
        age: pf.age,
        phone: c?.phone || '-',
        conditions: pf.conditions,
        complaint: '',
        painHistory: [],
        registeredOn: todayISO(),
        birthDate: birthToISO(acc.birthDate),
        userId: acc.userId,
        email: acc.email,
        citizenId: c?.citizenId,
        title: c?.title,
        address: c?.address,
        avatar: acc.avatar ?? defaultAvatar(acc.sex),
      };
    }
    const name = acc ? acc.name : 'สมศักดิ์ รักดี';
    const key = Array.from(name).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
    return { id: `app-p-${key}`, hn: `APP-${key.slice(-4).toUpperCase()}`, name: acc ? `คุณ${acc.name}` : 'คุณสมศักดิ์ รักดี', gender: acc?.sex === 'หญิง' ? 'หญิง' : 'ชาย', age: pf.age, phone: '-', conditions: pf.conditions, complaint: '', painHistory: [], registeredOn: todayISO(), birthDate: birthToISO(acc?.birthDate) };
  };

  const notifyClinic = useCallback((title: string, body: string) => {
    sendNote(title, `${patientOf().name} · ${body}`, patientOf().id, patientOf().name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addSymptomNote = (target: { caseId?: string; draftId?: string; looseId?: string }, title: string, text: string) => {
    const ref = isCloud() ? refOf(target) : undefined;
    const fallback = () => notifyClinic('แจ้งอาการเพิ่มหลังเช็กอิน', `${title}: ${text}`);
    if (!ref) return fallback();
    void cloudAddendum(ref, text)
      .then((ok) => !ok && fallback())
      .catch(fallback);
  };
  /** ส่งคำขอจอง + แบบประเมินก่อนรับบริการ ไปหลังบ้าน (รูปแบบ BookingRequest ของหลังบ้าน) */
  const sendRequest = (target: { draftId?: string; looseId?: string; caseId?: string }, label: string, caseBk?: { date: string; time: string; service: string; therapist: string; title: string; pain: number }) => {
    const { drafts: ds, looseBookings: ls, profile: pf } = latest.current;
    const d = ds.find((x) => x.id === target.draftId);
    const b = caseBk ?? d?.booking ?? ls.find((x) => x.id === target.looseId);
    if (!b) return false;
    // เลื่อนนัด = ยกเลิกคำขอ/นัดเดิมในคลินิก แล้วส่งใหม่ (ไม่ให้คลินิกมีนัดซ้อนสองรายการ)
    for (const [k, t] of Object.entries(bridgeRefs.current)) {
      const same = (!!target.draftId && t.draftId === target.draftId) || (!!target.looseId && t.looseId === target.looseId) || (!!target.caseId && t.caseBooking && t.caseId === target.caseId && !t.done);
      if (!same || t.done) continue;
      sendCancel(k, patientOf().name, 'ผู้ป่วยเลื่อนนัดจากแอป');
      delete bridgeRefs.current[k];
    }
    const patient = { ...patientOf(), complaint: caseBk ? caseBk.title : d ? d.title : 'นวดเพื่อสุขภาพ', painHistory: d ? [{ date: todayISO(), score: d.pain }] : [] };
    const risk = d?.risk ?? '';
    const id = `app-${Date.now().toString(36)}`;
    const request: ClinicRequest = {
      id,
      patientId: patient.id,
      serviceId: serviceCodeOf(b.service),
      // ผู้บำบัดของหลังบ้าน (จองจากตารางจริง → ชื่อตรงกัน · ไม่ระบุ = คนแรกที่ว่างรอบนั้น)
      therapistId: clinicTherapistId(b.therapist, labelToISO(b.date), b.time, serviceCodeOf(b.service)) ?? (isCloud() ? '' : /s2|s3|s5/.test(serviceCodeOf(b.service)) ? 't2' : 't1'),
      date: labelToISO(b.date),
      start: b.time,
      painScore: caseBk?.pain ?? d?.pain ?? 0,
      assessed: !!caseBk || !!d,
      screened: !!d?.risk,
      answers: d ? { duration: d.duration, health: d.health, meds: d.meds, allergy: d.allergy, risk: d.risk, radiate: d.radiate, related: d.related, pressure: d.pressure } : undefined,
      screening: { fever: /ไข้/.test(risk), highBP: pf.conditions.some((c) => /ความดัน/.test(c)), menstruation: /ประจำเดือน/.test(risk), pregnant: /ตั้งครรภ์/.test(risk), recentSurgery: /ผ่าตัด/.test(risk), contagious: /โรคติดต่อ/.test(risk) },
      intake: d
        ? {
            at: new Date().toISOString(),
            goal: /รักษา|ประคบ/.test(b.service) ? 'นวดเพื่อการรักษา' : 'นวดเพื่อสุขภาพ',
            complaint: d.title,
            pain: d.pain,
            duration: d.duration ?? '-',
            focusAreas: d.symptoms,
            avoidAreas: d.avoid && d.avoid !== 'ไม่มี' ? [d.avoid] : [],
            conditions: pf.conditions,
            medications: pf.medications,
            bloodThinner: pf.medications.some((m) => /ละลายลิ่มเลือด|warfarin|aspirin/i.test(m)),
            skin: /แผล|ผื่น/.test(risk) ? 'มีแผลหรือผื่น' : 'ปกติ',
            numbness: /ชา|อ่อนแรง/.test(d.radiate ?? '') || (d.related ?? []).some((x) => /ชา|อ่อนแรง/.test(x)),
            fever: /ไข้/.test(risk),
            pregnant: /ตั้งครรภ์/.test(risk) ? true : null,
            pressure: d.pressure === 'หนัก' || d.pressure === 'เบา' ? d.pressure : 'ปานกลาง',
            injury: /บาดเจ็บ/.test(risk) ? risk : undefined,
            surgery: /ผ่าตัด/.test(risk) ? risk : undefined,
            allergy: pf.allergies.join(', ') || undefined,
          }
        : undefined,
      note: d?.caution,
      // แนวทางการรักษาชุดเดียวกับที่ผู้ป่วยเห็นในแชท
      guide: guideOfDraft(d),
      submittedAt: new Date().toISOString(),
      serviceLabel: b.service,
    };
    bridgeRefs.current[id] = caseBk ? { caseId: target.caseId, caseBooking: true, label, patientId: patient.id, title: caseBk.title } : { ...target, label, patientId: patient.id };
    sendBooking(request, patient);
    return true;
  };
  const requestBooking = useCallback((target: { draftId?: string; looseId?: string }, label: string) => {
    // หลังบ้านเปิดอยู่ → รอเจ้าหน้าที่อนุมัติจริง · ไม่ได้เปิด → จำลองการยืนยัน
    // (รอให้ใบร่าง/นัดที่เพิ่งสร้างเข้า state ก่อน)
    if (clinicOnline()) {
      setTimeout(() => sendRequest(target, label), 300);
      return;
    }
    setTimeout(() => {
      const confirm = (b: Booking): Booking => ({ ...b, status: 'confirmed', queue: b.date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
      if (target.draftId) setDrafts((all) => all.map((d) => (d.id === target.draftId && d.booking ? { ...d, booking: confirm(d.booking) } : d)));
      if (target.looseId) setLooseBookings((all) => all.map((b) => (b.id === target.looseId ? { ...confirm(b), id: b.id } : b)));
      const d = new Date();
      setApptNotices((all) => [{ id: `n-ok-${Date.now()}`, ...target, kind: 'confirmed', text: `คลินิกยืนยันนัด ${label}`, at: `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }, ...all]);
    }, 6000);
  }, []);
  const bookCase = useCallback((caseId: string, appt: CaseAppt, service: string) => {
    if (!isCloud() || !latest.current.account?.userId) {
      setCaseAppointment(caseId, appt);
      return;
    }
    // บัญชีจริง: เป็นคำขอจอง → รอคลินิกยืนยัน · เลขคิวได้ตอนเช็กอินที่คลินิก
    setCaseAppointment(caseId, { ...appt, queue: undefined });
    const tc = casesRef.current.find((c) => c.id === caseId);
    const label = `${appt.date} ${appt.time}`;
    const pain = tc ? tc.visits[tc.visits.length - 1]?.painAfter ?? 0 : 0;
    setTimeout(() => sendRequest({ caseId }, label, { date: appt.date, time: appt.time, service, therapist: appt.therapist, title: tc?.short ?? 'นัดตามแผนการรักษา', pain }), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCaseAppointment]);
  /** id ของคำขอจองใน cloud/สะพาน ที่ผูกกับเรื่องนี้ */
  const refOf = (target: { draftId?: string; looseId?: string; caseId?: string }) =>
    // นัดของใบการรักษาที่อยู่ใน cloud (บัญชีตัวอย่าง)
    (target.caseId ? Object.keys(caseLinks.current).find((k) => caseLinks.current[k].caseId === target.caseId && !caseLinks.current[k].billId && !caseLinks.current[k].done) : undefined) ??
    (target.caseId ? Object.keys(bridgeRefs.current).find((k) => bridgeRefs.current[k].caseBooking && bridgeRefs.current[k].caseId === target.caseId && !bridgeRefs.current[k].done) : undefined) ??
    Object.keys(bridgeRefs.current).find((k) => {
      const t = bridgeRefs.current[k];
      return (!!target.draftId && t.draftId === target.draftId) || (!!target.looseId && t.looseId === target.looseId);
    });
  const cloudRefOf = useCallback((target: { draftId?: string; looseId?: string; caseId?: string }) => (isCloud() ? refOf(target) : undefined), []);
  const [checkinErrors, setCheckinErrors] = useState<Record<string, string>>({});
  const checkIn = useCallback(async (target: { draftId?: string; looseId?: string; caseId?: string }, code?: string) => {
    const ref = refOf(target);
    if (!ref) return false;
    setCheckinErrors((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== ref)));
    return sendCheckIn(ref, patientOf().name, code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cancelBooking = useCallback((target: { draftId?: string; looseId?: string; caseId?: string }) => {
    const ref = refOf(target);
    if (!ref) return;
    // คลินิกเริ่มให้บริการไปแล้ว (ยกเลิกไม่ได้) → ยังรับผลการรักษา/บิลของนัดนี้ต่อ
    void sendCancel(ref, patientOf().name).then((ok) => {
      if (ok) delete bridgeRefs.current[ref];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // รับเหตุการณ์จากหลังบ้าน: อนุมัติ/ปฏิเสธ · นวดเสร็จ · ยกเลิก/ไม่มา · (cloud) คิว · เริ่มบริการ · บิล · ใบเสร็จ
  const onClinic = React.useRef<(events: ClinicEvent[]) => void>(() => {});
  React.useEffect(() => {
    void setupNotifications();
    return listenClinic((ev) => {
      // เด้งแจ้งเตือนเฉพาะนัด/บิลของผู้ใช้คนนี้ (cloud มีนัดของทุกคน) — ตรวจก่อนประมวลผล เพราะนัดที่จบแล้วจะถูกลืม
      const me = patientOf().id;
      const mine = ev.filter((e) => ('ref' in e && (bridgeRefs.current[e.ref] || caseLinks.current[e.ref])) || ('patientId' in e && e.patientId === me));
      onClinic.current(ev);
      for (const e of mine) {
        const n = noticeOf(e);
        if (n) void notify(...n);
      }
    });
  }, []);
  // นัดที่คลินิกลงให้ (นัดตามคอร์ส) แต่ยังไม่มีในแอป → เพิ่มเข้ามา (เช่น แอปรุ่นเก่าเคยเห็นแถวนั้นแล้วแต่ไม่ได้รับ)
  /**
   * กำลังรับบริการตามแถวในคลินิก → ใส่สถานะ + เวลาเริ่มให้นัดในแอปที่ยังไม่มี (เริ่มไปก่อนเปิดแอป / ก่อนแอปรุ่นที่เก็บเวลาเริ่ม)
   * เวลาเริ่ม = เวลาที่แถวเปลี่ยนเป็นกำลังรับบริการ (ค่าแรกที่เห็น ไม่เลื่อนตามการแก้ไขระหว่างนวด)
   */
  const syncInService = () => {
    const live = (ref: string) => {
      const r = cloudRowOf(ref);
      return r?.status === 'in_service' ? r.updated_at : undefined;
    };
    // ระยะเวลาตามบริการของนัดนั้นในคลินิก (คลินิกเปลี่ยนบริการได้ เช่น นวดร่วมประคบ 90 นาที)
    const mins = (ref: string) => {
      const r = cloudRowOf(ref) as (CloudRow & { assessment?: { serviceId?: string } }) | undefined;
      return serviceMinutesOf(r?.service, r?.assessment?.serviceId);
    };
    const { drafts: ds, looseBookings: ls } = latest.current;
    for (const [ref, t] of Object.entries(bridgeRefs.current)) {
      const at = live(ref);
      if (!at) continue;
      const n = mins(ref);
      const need = (x?: { startedAt?: string; minutes?: number }) => !!x && (!x.startedAt || x.minutes !== n);
      if (t.draftId && ds.some((d) => d.id === t.draftId && need(d.booking)))
        setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking && need(d.booking) ? { ...d, booking: { ...d.booking, stage: 'in_service', startedAt: d.booking.startedAt ?? at, minutes: n } } : d)));
      if (t.looseId && ls.some((b) => b.id === t.looseId && need(b)))
        setLooseBookings((all) => all.map((b) => (b.id === t.looseId && need(b) ? { ...b, stage: 'in_service', startedAt: b.startedAt ?? at, minutes: n } : b)));
      if (t.caseId && t.caseBooking) setCaseAppts((m) => (need(m[t.caseId!]) ? { ...m, [t.caseId!]: { ...m[t.caseId!], stage: 'in_service', startedAt: m[t.caseId!].startedAt ?? at, minutes: n } } : m));
    }
    for (const [ref, l] of Object.entries(caseLinks.current)) {
      const at = live(ref);
      if (!at || l.done) continue;
      const n = mins(ref);
      setCaseAppts((m) => (m[l.caseId] && (!m[l.caseId].startedAt || m[l.caseId].minutes !== n) ? { ...m, [l.caseId]: { ...m[l.caseId], stage: 'in_service', startedAt: m[l.caseId].startedAt ?? at, minutes: n } } : m));
    }
  };
  React.useEffect(() => {
    if (!isCloud()) return;
    const t = setInterval(() => {
      if (!latest.current.account?.userId) return;
      syncInService();
      const me = patientOf().id;
      const missing = clinicMadeRows().filter((r) => r.patient_id === me && !bridgeRefs.current[r.id] && !caseLinks.current[r.id]);
      if (!missing.length) return;
      onClinic.current(
        missing.map((r) => {
          const as = (r as CloudRow & { assessment?: { course?: { name: string; no: number; total: number } } }).assessment;
          return { id: `${r.id}:sync`, at: r.updated_at, type: 'approved' as const, ref: r.id, date: r.date ?? '', start: r.start ?? '', therapist: r.therapist ?? '', service: r.service ?? '', cloud: true, byClinic: true, patientId: r.patient_id, course: as?.course };
        }),
      );
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nowAtLabel = () => {
    const d = new Date();
    return `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const payBill = useCallback((id: string) => {
    const d = new Date();
    const at = `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    // บิลจากคลินิก (cloud) → แจ้งหลังบ้านว่าชำระแล้ว (บิลในระบบคลินิกปิดเอง)
    const cr = latest.current.bills.find((b) => b.id === id)?.cloudRef;
    if (cr) sendPayment(cr, patientOf().name);
    // เลขใบเสร็จ: คลินิกจองไว้มากับบิล (หรือส่งตามมาตอนปิดบิล) · ไม่มีคลินิก (โหมดเดิม) = เลขจำลองตามปี พ.ศ.
    setBills((all) => all.map((b) => (b.id === id ? { ...b, status: 'paid', method: 'app', paidAt: at, receiptNo: b.receiptNo ?? (cr ? undefined : `RC${new Date().getFullYear() + 543}-${String(124 + all.indexOf(b)).padStart(6, '0')}`) } : b)));
    // บิลนี้จ่ายแล้ว → แจ้งเตือนบิลถือว่าอ่านแล้ว
    setApptNotices((all) => all.map((n) => (n.billId === id ? { ...n, read: true } : n)));
  }, []);
  /**
   * ประเมินก่อนนวดครั้งถัดไป → เก็บในแอป + ส่งเข้าแถวนัดของครั้งนั้นที่หลังบ้าน (คิวรอส่ง: ออฟไลน์/ยังไม่มีแถวนัด → ส่งใหม่ทีหลัง)
   * ไม่มีแถวนัดในแอป (คลินิกยังไม่ลงนัด/ไม่ใช่ cloud) → ส่งเป็นข้อความ (หลังบ้านผูกกับนัดถัดไปของผู้ป่วยเอง)
   */
  const pendingPre = React.useRef<Record<string, CaseToday & { at: string; tries: number }>>(saved('pendingPre', {}));
  const flushPreVisit = React.useCallback(async () => {
    for (const [caseId, v] of Object.entries(pendingPre.current)) {
      const ref = refOf({ caseId });
      const tc = casesRef.current.find((c) => c.id === caseId);
      const no = tc ? tc.course.done + 1 : undefined;
      const summary = `ประเมินก่อนนวด${no ? `ครั้งที่ ${no}` : ''} · ปวด ${v.pain}/10${v.adverse ? ` · หลังนวดครั้งก่อน ${v.adverse}` : ''}${v.risk && v.risk !== 'ไม่มี' ? ` · ${v.risk}` : ''}${v.red ? ' · ควรพบแพทย์ก่อนนวด' : ''}`;
      const r = v.risk ?? '';
      const screening = { fever: r === 'มีไข้', pregnant: r === 'ตั้งครรภ์', recentSurgery: /ผ่าตัด/.test(r), contagious: r === 'โรคติดต่อ', menstruation: r === 'มีประจำเดือน' };
      if (ref && isCloud()) {
        const ok = await sendPreVisit(ref, { at: v.at, pain: v.pain, adverse: v.adverse, risk: v.risk, red: v.red, summary, screening }, patientOf().name);
        if (ok) {
          delete pendingPre.current[caseId];
          log('ระบบ → ผู้ให้บริการ', `ส่งผลประเมินก่อนนวดเข้านัดแล้ว · ${summary}`);
          continue;
        }
      }
      // ยังส่งเข้าแถวนัดไม่ได้: ลองใหม่ (ออฟไลน์) · ไม่มีแถวนัด/ลองหลายรอบแล้ว → ส่งเป็นข้อความแทน
      v.tries += 1;
      if ((!ref || v.tries >= 6) && sendNote(v.red ? 'ผลประเมินก่อนนวด: ควรพบแพทย์ก่อน' : 'ผลประเมินก่อนนวดจากแอป', `${patientOf().name} · ${tc?.short ?? ''} · ${summary}`, patientOf().id, patientOf().name)) delete pendingPre.current[caseId];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    // ค้างส่ง → ลองใหม่ทุก 10 วินาที
    const id = setInterval(() => {
      if (Object.keys(pendingPre.current).length) void flushPreVisit();
    }, 10000);
    return () => clearInterval(id);
  }, [flushPreVisit]);
  const setCaseToday = useCallback((caseId: string, v: CaseToday) => {
    setCaseTodayState((m) => ({ ...m, [caseId]: v }));
    pendingPre.current[caseId] = { ...v, at: new Date().toISOString(), tries: 0 };
    setTimeout(() => void flushPreVisit(), 0);
  }, [flushPreVisit]);
  const recordCaseVisit = useCallback((caseId: string, painBefore: number, painAfter: number) => {
    // นวดครั้งนี้แล้ว → ประเมินก่อนนวดรอบนี้ใช้ไปแล้ว
    setCaseTodayState((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== caseId)));
    setCaseVisits((m) => ({ ...m, [caseId]: [...(m[caseId] ?? []), { date: 'วันนี้', painBefore, painAfter }] }));
    // นัดนี้ใช้แล้ว → ยังไม่มีนัดครั้งถัดไป
    setCaseAppts((m) => ({ ...m, [caseId]: { today: false, date: '-', time: '-', clinic: m[caseId]?.clinic ?? '', therapist: m[caseId]?.therapist ?? '' } }));
  }, []);
  const signOut = useCallback((localOnly?: boolean) => {
    if (!localOnly) void signOutCloud();
    setSession((n) => n + 1);
    // ล้างข้อมูลที่จำไว้ + คำขอที่ส่งไปหลังบ้าน
    try {
      removeItem(APP_STATE_KEY);
      removeItem(CHATS_KEY);
    } catch {
      /* ignore */
    }
    // ลืมค่าที่โหลดไว้ตอนเปิดแอปด้วย ไม่อย่างนั้นหน้าเข้าสู่ระบบพากลับหน้าแรกทันที
    SAVED = null;
    setEntered(false);
    bridgeRefs.current = {};
    bridgedCase.current = {};
    pendingPlan.current = {};
    setVisitRecords({});
    setPlannedVisits({});
    setAccount(null);
    setNewPatient(false);
    setCareStage('new');
    setLooseBookings([]);
    setLastAssess(null);
    setDrafts([]);
    setActiveDraftId(null);
    setPromoted([]);
    setCancelledAppts([]);
    setCaseAppts({});
    setFollowUps([]);
    setProfile(baseProfile);
    setConsents({ service: false, aiProcessing: false, followUp: true, research: false });
    // ไม่ให้ข้อมูลของบัญชีก่อนหน้าค้าง (บันทึกการเข้าถึง · ธาตุ · คะแนนก่อน/หลัง · ฯลฯ)
    setCaseVisits({});
    setSelfPains({});
    setCaseTodayState({});
    setApptNotices(SAMPLE_NOTICES);
    setBills(SAMPLE_BILLS);
    setAudit([{ at: '09:02', actor: 'ผู้รับบริการ', action: 'ลงทะเบียนผ่าน MyAtlas' }]);
    setElementsState({ ไฟ: 45, ลม: 25, น้ำ: 20, ดิน: 10 });
    setElementsDone(false);
    setBefore(initialBefore);
    setAfter(undefined);
    setAcknowledged([]);
    setRecord(initialRecord);
    setScenarioState('caution');
  }, []);
  const promoteDraft = useCallback((draftId: string, painAfter: number, diagnosis?: string) => {
    setDrafts((all) => {
      const d = all.find((x) => x.id === draftId);
      if (!d) return all;
      setPromoted((cs) => [...cs.filter((c) => c.id !== `case-${d.id}`), draftToCase(d, painAfter, diagnosis)]);
      return all.filter((x) => x.id !== draftId);
    });
    // ใบร่างนี้ไม่มีแล้ว → ไม่ให้การจองครั้งถัดไปไปผูกกับใบที่หายไป
    setActiveDraftId((id) => (id === draftId ? null : id));
  }, []);
  const upsertDraft = useCallback((d: DraftCase) => {
    // ประเมินเรื่องเดิมอีกครั้งหลังจอง (ก่อนเช็กอิน) → ส่งเป็นรอบใหม่ให้คลินิก (รอบเดิมเก็บไว้) · เช็กอินแล้วคลินิกไม่รับ → แจ้งผู้ใช้
    const old = latest.current.drafts.find((x) => x.id === d.id);
    if (isCloud() && old?.booking && d.booking && (old.pain !== d.pain || old.symptoms.join() !== d.symptoms.join() || old.title !== d.title || old.risk !== d.risk)) {
      const ref = refOf({ draftId: d.id });
      if (ref)
        void cloudReassess(ref, { guide: guideOfDraft(d), complaint: d.title, pain: d.pain, areas: d.symptoms, avoid: d.avoid && d.avoid !== 'ไม่มี' ? [d.avoid] : [], summary: `ประเมินใหม่: ${d.title} · ปวด ${d.pain}/10${d.caution ? ` · ${d.caution}` : ''}` })
          .then((ok) => {
            if (!ok) setApptNotices((all) => [{ id: `n-ra-${Date.now()}`, draftId: d.id, kind: 'reminder', text: 'ส่งผลประเมินใหม่ไม่ได้ · คลินิกเริ่มขั้นตอนของนัดนี้แล้ว · แจ้งอาการเพิ่มได้ที่หน้านัด', at: nowAtLabel() }, ...all]);
          })
          .catch(() => undefined);
    }
    setDrafts((all) => (all.some((x) => x.id === d.id) ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const removeDraft = useCallback((id: string) => setDrafts((all) => all.filter((x) => x.id !== id)), []);
  const log = useCallback((actor: string, action: string) => {
    const d = new Date();
    const at = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    setAudit((a) => [{ at, actor, action }, ...a]);
  }, []);

  const setScenario = useCallback((s: Scenario) => {
    setScenarioState(s);
    setProfile(s === 'redflag' ? redFlagProfile : baseProfile);
    setAcknowledged([]);
  }, []);

  const reset = useCallback(() => {
    setScenario('caution');
    setConsents({ service: false, aiProcessing: false, followUp: true, research: false });
    setAfter(undefined);
    setAcknowledged([]);
    setRecord(initialRecord);
    setBefore(initialBefore);
  }, [setScenario]);

  const safety = useMemo(() => evaluateSafety(profile), [profile]);

  const cases = useMemo(
    () =>
      [...(newPatient ? [] : TREATMENT_CASES), ...promoted].map((c) => {
        const extra = caseVisits[c.id] ?? [];
        const a = caseAppts[c.id];
        const cancelled = cancelledAppts.includes(c.id);
        const sp = selfPains[c.id];
        const visits = [...c.visits, ...extra].map((v, i) => (visitRecords[`${c.id}:${i}`] ? { ...v, record: visitRecords[`${c.id}:${i}`] } : v));
        const done = Math.min(c.course.total, c.course.done + extra.length);
        const appointment = cancelled ? { today: false, date: '-', time: '-' } : a ? { today: a.today, date: a.date, time: a.time, queue: a.queue, stage: a.stage, startedAt: a.startedAt, minutes: a.minutes } : c.appointment;
        // ครั้งที่ใช้ไป: นับจากในแอป หรือจากคลินิก (เรื่องที่ผูกกับคลินิก) แล้วแต่อันไหนมากกว่า — ชุดเดียวกับการ์ดแผนการรักษา
        const bridged = Object.values(bridgedCase.current).includes(c.id);
        const total = bridged && clinicCourse ? clinicCourse.total : c.course.total;
        const used = Math.max(done, bridged && clinicCourse ? clinicCourse.used : 0);
        return {
          finished: used >= total && appointment.date === '-',
          ...c,
          // คะแนนหลังนวดที่ผู้ใช้ประเมินเอง → ครั้งล่าสุด
          visits: sp && sp.n === visits.length ? visits.map((v, i) => (i === visits.length - 1 ? { ...v, selfPain: sp.v } : v)) : visits,
          // ครั้งที่นวดเพิ่ม → มีรอบติดตามผลของครั้งนั้น (ล่าสุดอยู่หน้า)
          pending: [...extra.map((v, i) => ({ id: `sess-${c.id}-${c.visits.length + i + 1}`, date: v.date, plan: c.plan, areas: c.areas })).reverse(), ...c.pending],
          course: { ...c.course, done },
          therapist: a?.therapist || c.therapist,
          appointment,
        };
      }),
    [newPatient, promoted, caseAppts, cancelledAppts, caseVisits, selfPains, visitRecords, clinicCourse],
  );
  casesRef.current = cases;
  const nowAt = () => {
    const d = new Date();
    return `วันนี้ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const clinicCloseVisit = useCallback(
    (target: { caseId?: string; draftId?: string }, clinicPainAfter?: number, opts?: CloseOpts) => {
      const tc = cases.find((c) => c.id === target.caseId);
      const d = drafts.find((x) => x.id === target.draftId);
      if (!tc && !d) return undefined;
      const caseId = tc?.id ?? `case-${d!.id}`;
      const title = tc?.short ?? d!.title;
      // ก่อนนวด = ประเมินก่อนนวดวันนี้ / หลังนวดครั้งก่อน · หลังนวด = คลินิกบันทึก (จำลอง)
      const painBefore = tc ? caseToday[tc.id]?.pain ?? tc.visits[tc.visits.length - 1].painAfter : d!.pain;
      // คะแนนจากหลังบ้าน (นวดเสร็จ) · ไม่มี = จำลอง
      // คลินิกข้ามการประเมินหลังนวด (ไม่บังคับ) → ไม่เดาคะแนนเอง ใช้เท่าก่อนนวด แล้วให้ผู้ใช้ประเมินเองในแอป
      const painAfter = clinicPainAfter ?? (isCloud() ? painBefore : Math.max(0, painBefore - 2));
      const no = tc ? tc.visits.length + 1 : 1;
      if (tc) recordCaseVisit(tc.id, painBefore, painAfter);
      else promoteDraft(d!.id, painAfter, opts?.diagnosis);
      // คะแนนจากหลังบ้าน = ผู้ป่วยเลือกเองที่คลินิก (ขั้นประเมินหลังนวด) → นับเป็นการประเมินหลังนวดของครั้งนี้ ไม่ต้องประเมินซ้ำในแอป
      if (clinicPainAfter !== undefined) setSelfPains((m) => ({ ...m, [caseId]: { n: no, v: clinicPainAfter } }));
      // บันทึกการรักษาจริงจากคลินิก → แสดงในรายละเอียดครั้งนั้นแทนข้อมูลตัวอย่าง
      if (opts?.record) setVisitRecords((m) => ({ ...m, [`${caseId}:${no - 1}`]: opts.record! }));
      // cloud: คลินิกเป็นคนออกบิลจริง (มาทีหลังเป็นเหตุการณ์ bill) → ไม่จำลองบิล
      if (opts?.bill !== false && !isCloud()) {
        const service = tc ? tc.plan : d!.booking?.service ?? 'นวดไทยเพื่อการรักษา';
        const billId = `b-${caseId}-${no}`;
        setBills((all) => [{ id: billId, caseId, title: `${title} ครั้งที่ ${no}`, date: 'วันนี้', items: [{ name: service, amount: 450 }], total: 450, status: 'pending' }, ...all.filter((b) => b.id !== billId)]);
        setApptNotices((all) => [{ id: `n-bill-${billId}`, caseId, kind: 'bill', billId, text: `บิล${title} ครั้งที่ ${no} รอชำระ 450 บาท`, at: nowAt() }, ...all]);
      }
      // การประเมินมีแค่ก่อนนวดและหลังนวด (ไม่มีติดตามผลรายวัน) → หลังนวดผู้ใช้ประเมินเองจากหน้าผลลัพธ์/หน้าแรก
      return caseId;
    },
    [cases, drafts, caseToday, recordCaseVisit, promoteDraft],
  );
  const setVisitSelfPain = useCallback((caseId: string, pain: number) => {
    // คะแนนหลังนวดของครั้งล่าสุด (นับจากจำนวนครั้ง ณ ตอนประเมิน → ครั้งใหม่ไม่รับค่าเก่า)
    const n = cases.find((c) => c.id === caseId)?.visits.length ?? 0;
    setSelfPains((m) => ({ ...m, [caseId]: { n, v: pain } }));
    // นัดครั้งล่าสุดของเรื่องนี้ที่คลินิกบันทึกการรักษาแล้ว → ส่งคะแนนหลังนวดให้คลินิกใส่ในนัดนั้น
    if (isCloud()) {
      const done = ['recorded', 'billed', 'paid', 'closed'];
      const ref = [...Object.keys(bridgeRefs.current).filter((k) => bridgeRefs.current[k].caseId === caseId), ...Object.keys(caseLinks.current).filter((k) => caseLinks.current[k].caseId === caseId)]
        .filter((k) => done.includes(cloudStatusOf(k) ?? ''))
        .pop();
      if (ref) void cloudAfterPain(ref, pain).catch(() => undefined);
    }
  }, [cases]);

  const sendFollowUp = useCallback(
    async (p: Omit<FollowUpPayload, 'hn' | 'channel'>) => {
      const rec = await submitFollowUp({ ...p, hn: clinicHnRef.current ?? (latest.current.account ? patientOf().hn : 'TW-000123'), channel: 'home-body-map' });
      setFollowUps((all) => [rec, ...all.filter((r) => r.sessionId !== rec.sessionId)]);
      log('ผู้รับบริการ', `ส่งผลติดตามอาการ ${rec.sessionDate}: ${rec.areas.map((a) => `${a.area} ${a.painBefore}→${a.painAfter}`).join(', ')}`);
      return rec;
    },
    [log],
  );

  /** แผนจากคลินิก → นัดครั้งถัดไปของเรื่องนั้น + จำนวนครั้งของคอร์ส */
  const applyPlan = (caseId: string, e: Extract<ClinicEvent, { type: 'plan' }>) => {
    const tc = cases.find((c) => c.id === caseId);
    // จำนวนครั้งของคอร์ส + แผนที่แพทย์อนุมัติ (แสดงในรายละเอียดเรื่องนั้น)
    const clinicPlan = e.summary ? { summary: e.summary, sessions: e.course?.total ?? 0, frequency: e.frequency ?? '', homeCare: e.homeCare ?? [] } : undefined;
    setPromoted((cs) =>
      cs.map((c) => (c.id === caseId ? { ...c, course: e.course ? { ...c.course, total: Math.max(e.course.total, c.course.done) } : c.course, clinicPlan: clinicPlan ?? c.clinicPlan } : c)),
      // (จำนวนครั้งที่ใช้ไป = ครั้งที่นวดจริงในแอป · จำนวนทั้งหมด = คอร์สในคลินิก)
    );
    // แผนจาก cloud: สรุปแผน + จำนวนครั้ง (นัดครั้งถัดไปคลินิกลงให้ทีหลัง)
    if (!e.next && e.summary) setApptNotices((all) => [{ id: `n-plan-${e.id}`, caseId, kind: 'confirmed', text: `คลินิกส่งแผนการรักษา: ${e.summary}${e.course ? ` · ${e.course.total} ครั้ง` : ''}${e.frequency ? ` (${e.frequency})` : ''}`, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-plan-${e.id}`)]);
    if (!e.next) return;
    const date = isoToLabel(e.next.date);
    setCaseAppointment(caseId, { today: date === 'วันนี้', date, time: e.next.start, clinic: tc?.clinic ?? '', therapist: e.next.therapist, queue: date === 'วันนี้' && !isCloud() ? `A${++queueNo.current}` : undefined });
    const no = (tc?.visits.length ?? 1) + 1;
    setApptNotices((all) => [{ id: `n-plan-${e.id}`, caseId, kind: 'confirmed', text: `คลินิกนัดครั้งที่ ${no} ตามแผนการรักษา ${date} ${e.next!.start}${e.next!.therapist ? ` · ${e.next!.therapist}` : ''}`, at: nowAtLabel() }, ...all]);
  };
  /** คลินิกปิดการรักษาของนัดที่ส่งจากแอป → ใบการรักษา · คืน case id (จำไว้ที่ ref ให้บิล/ใบเสร็จที่ตามมา) */
  const closeFromClinic = (ref: string, t: BridgeRef, e: { painBefore: number; painAfter?: number } | undefined, opts?: CloseOpts) => {
    let caseId: string | undefined;
    const title = t.draftId ? latest.current.drafts.find((d) => d.id === t.draftId)?.title : 'นวดเพื่อสุขภาพ';
    if (t.draftId) caseId = clinicCloseVisit({ draftId: t.draftId }, e?.painAfter, opts);
    else if (t.looseId && t.course && t.patientId && caseFor(t.patientId)) {
      // นัดตามคอร์ส → ครั้งใหม่ของเรื่องเดิม (ไม่ใช่เรื่องใหม่ทุกครั้ง)
      caseId = clinicCloseVisit({ caseId: bridgedCase.current[t.patientId] }, e?.painAfter, { ...opts, bill: false });
      setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
    } else if (t.looseId) {
      // นัดที่จองก่อนประเมิน → เป็นเรื่องที่รักษาด้วย (ไว้รับแผน/ครั้งต่อไปจากคลินิก)
      const lb = latest.current.looseBookings.find((b) => b.id === t.looseId);
      if (lb) {
        const { id: _drop, ...booking } = lb;
        const painBefore = e?.painBefore ?? 5;
        const d: DraftCase = { id: `d-${t.looseId}`, title: t.course && t.title ? t.title : 'นวดเพื่อสุขภาพ', symptoms: [], pain: painBefore, red: false, stage: 'booked', booking: { ...booking, status: 'confirmed' } };
        setDrafts((all) => [...all, d]);
        promoteDraft(d.id, e?.painAfter ?? painBefore, opts?.diagnosis);
        setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
        caseId = `case-${d.id}`;
        if (e?.painAfter !== undefined) setSelfPains((m) => ({ ...m, [`case-${d.id}`]: { n: 1, v: e.painAfter! } }));
        if (opts?.record) setVisitRecords((m) => ({ ...m, [`case-${d.id}:0`]: opts.record! }));
      }
      setApptNotices((all) => [{ id: `n-done-${ref}`, kind: 'confirmed', text: `คลินิกบันทึกการนวดแล้ว ${t.label}`, at: nowAtLabel() }, ...all]);
    }
    if (caseId) bridgeRefs.current[ref] = { ...t, caseId, title: title ?? t.label };
    return caseId;
  };
  /* ---------- บัญชีตัวอย่าง ↔ หลังบ้าน: นัด/บิลของคุณสมศักดิ์อยู่ใน cloud ชุดเดียวกับคลินิก ---------- */
  React.useEffect(() => {
    caseLinks.current = {};
    if (account || newPatient || !isCloud()) return;
    for (const [ref, l] of Object.entries(DEMO_LINKS)) caseLinks.current[ref] = { ...l };
    bridgedCase.current[DEMO_PATIENT_CLOUD_ID] = 'case-office';
    // ตั้งต้นจากสถานะจริงในคลินิก (วัน เวลา ผู้บำบัด เลขคิว · บิลที่จ่ายแล้ว)
    void fetchCloudRows(Object.keys(DEMO_LINKS)).then((rows) => {
      for (const r of rows) {
        const l = caseLinks.current[r.id];
        if (!l) continue;
        if (l.billId) {
          if (r.bill?.status === 'paid') setBills((all) => all.map((b) => (b.id === l.billId ? { ...b, status: 'paid', receiptNo: r.bill?.receipt_no ?? b.receiptNo, paidAt: b.paidAt ?? 'ชำระแล้ว' } : b)));
          continue;
        }
        if (['confirmed', 'checked_in', 'called', 'in_service'].includes(r.status) && r.date) {
          const date = isoToLabel(r.date);
          setCaseAppointment(l.caseId, { today: date === 'วันนี้', date, time: r.start ?? '', clinic: '', therapist: r.therapist ?? '', queue: r.queue_no ?? undefined, ...stageOfRow(r) });
        } else if (r.status === 'cancelled' || r.status === 'no_show') {
          setCaseAppts((m) => ({ ...m, [l.caseId]: { today: false, date: '-', time: '-', clinic: '', therapist: '' } }));
        }
      }
    });
  }, [account, newPatient, session, setCaseAppointment]);
  /** เหตุการณ์จากคลินิกของนัด/บิลในบัญชีตัวอย่าง */
  /* ---------- นัดที่คลินิกลงเองตามแผน (ทุกบัญชี) ----------
   * แถวใน cloud ของผู้ป่วยคนนี้ที่ไม่ได้จองจากแอป = นัดครั้งถัดไปตามแผน → ผูกกับเรื่องที่รักษาของผู้ป่วยคนนั้น
   * นัดที่ใกล้ที่สุด = นัดครั้งถัดไปของเรื่อง (การ์ดนัดครั้งที่ N) · ที่เหลือ = รายการนัดตามแผน · เช็กอิน/คิว/ผล/บิล ใช้ทางเดียวกับนัดตัวอย่าง (caseLinks) */
  /**
   * เรื่องที่รักษาอยู่ของผู้ป่วยคนนี้ (1 การรักษา = 1 แท็บ) — นัด/แผนที่คลินิกลงให้ต้องเข้าเรื่องนี้ ไม่สร้างแท็บใหม่
   * จำไว้ใน bridgedCase · ไม่มี (เข้าสู่ระบบใหม่/ข้อมูลเก่า) → เรื่องที่ได้จากคลินิกล่าสุดที่ยังไม่ครบคอร์ส (ครบแล้ว = ไม่ผูก)
   */
  const caseFor = (pid?: string) => {
    if (!pid) return undefined;
    const mine = casesRef.current.filter((c) => promotedRef.current.some((p) => p.id === c.id));
    const cur = bridgedCase.current[pid];
    if (cur && casesRef.current.some((c) => c.id === cur)) return cur;
    // ครบคอร์สแล้ว = จบเรื่องนั้น → นัดใหม่จากคลินิกเป็นเรื่องใหม่ได้
    const c = [...mine].reverse().find((x) => x.course.done < x.course.total);
    if (!c) return undefined;
    bridgedCase.current[pid] = c.id;
    return c.id;
  };
  /**
   * การรักษาที่จองไว้แล้วแต่ยังไม่ได้นวดครั้งแรก (ใบร่าง/นัดที่จองก่อนประเมิน ส่งคลินิกแล้ว) → คลินิกลงคอร์สให้ = ครั้งถัดไปของการรักษานี้ ไม่ใช่เรื่องใหม่
   * ใบร่าง → id เรื่องที่จะเกิดหลังนวดครั้งแรก (case-<ใบร่าง>) ใช้เก็บนัดตามแผนไว้ล่วงหน้า · นัดที่จองก่อนประเมิน → ยังไม่รู้ id (รอนวดครั้งแรก)
   */
  const bookedFor = (pid?: string): { caseId?: string; draftId?: string; looseId?: string } | undefined => {
    if (!pid) return undefined;
    const { drafts: ds, looseBookings: ls } = latest.current;
    for (const t of Object.values(bridgeRefs.current)) {
      if (t.patientId !== pid || t.done || t.course || t.caseId) continue;
      if (t.draftId && ds.some((d) => d.id === t.draftId && d.booking)) return { caseId: `case-${t.draftId}`, draftId: t.draftId };
      if (t.looseId && !t.looseId.startsWith('lc-') && ls.some((b) => b.id === t.looseId)) return { looseId: t.looseId };
    }
    return undefined;
  };
  const syncPlanned = React.useRef(() => {});
  syncPlanned.current = () => {
    if (!isCloud()) return;
    const me = patientOf().id;
    // ยังไม่มีเรื่องที่รักษา แต่จองครั้งแรกไว้แล้ว (ใบร่าง) → เก็บนัดตามแผนไว้กับการรักษานั้น (นัดแรกยังเป็นนัดที่จองเอง)
    const real = caseFor(me);
    const caseId = real ?? bookedFor(me)?.caseId;
    if (!caseId) return;
    void fetchPatientRows(me).then((rows) => {
      if (!rows) return;
      const planned = rows
        .filter((r) => !bridgeRefs.current[r.id] && !(caseLinks.current[r.id] && !caseLinks.current[r.id].planned) && r.date && r.start)
        .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
      // ลงทะเบียนใหม่ตามลำดับวัน (นัดแรกที่ยังไม่นวด = นัดที่เช็กอินได้)
      for (const k of Object.keys(caseLinks.current)) if (caseLinks.current[k].planned && !caseLinks.current[k].done) delete caseLinks.current[k];
      for (const r of planned) caseLinks.current[r.id] = { caseId, planned: true };
      const list = planned.map((r) => ({ id: r.id, iso: r.date!, date: isoToLabel(r.date!), time: r.start!, therapist: r.therapist ?? '' }));
      setPlannedVisits((m) => (JSON.stringify(m[caseId] ?? []) === JSON.stringify(list) ? m : { ...m, [caseId]: list }));
      const first = planned[0];
      if (first && real) {
        const date = isoToLabel(first.date!);
        setCaseAppointment(caseId, { today: date === 'วันนี้', date, time: first.start!, clinic: '', therapist: first.therapist ?? '', queue: first.queue_no ?? undefined, ...stageOfRow(first) });
      }
    });
  };
  // แท็บที่สร้างผิดจากนัดที่คลินิกลงให้ (ทั้งที่มีเรื่องที่รักษาอยู่แล้ว) → รวมเข้าเรื่องเดิม: เอาแท็บออก แล้วดึงเป็นนัดตามแผนของเรื่องนั้น
  React.useEffect(() => {
    if (!isCloud()) return;
    const stray = looseBookings.filter((b) => b.id.startsWith('lc-'));
    if (!stray.length || !(caseFor(patientOf().id) ?? bookedFor(patientOf().id))) return;
    for (const [k, t] of Object.entries(bridgeRefs.current)) if (t.looseId && stray.some((b) => b.id === t.looseId)) delete bridgeRefs.current[k];
    setLooseBookings((all) => all.filter((b) => !b.id.startsWith('lc-')));
    setTimeout(() => syncPlanned.current(), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [looseBookings, promoted]);
  // เปิดแอป / เปลี่ยนบัญชี → ดึงนัดตามแผนที่คลินิกลงไว้ระหว่างปิดแอป
  React.useEffect(() => {
    const t = setTimeout(() => syncPlanned.current(), 800);
    return () => clearTimeout(t);
  }, [account, newPatient, session]);
  const onCaseEvent = (ref: string, l: { caseId: string; billId?: string; done?: boolean; title?: string; planned?: boolean }, e: ClinicEvent) => {
    const setLink = (v: typeof l) => {
      if (caseLinks.current[ref]) caseLinks.current[ref] = v;
      else if (bridgeRefs.current[ref]) bridgeRefs.current[ref] = { ...bridgeRefs.current[ref], ...v };
    };
    const tc = cases.find((c) => c.id === l.caseId);
    const note = (kind: ApptNotice['kind'], text: string, billId?: string) =>
      setApptNotices((all) => [{ id: `n-${e.id}`, caseId: l.caseId, kind, text, billId, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-${e.id}`)]);
    const current = (): CaseAppt => ({ today: !!tc?.appointment.today, date: tc?.appointment.date ?? '-', time: tc?.appointment.time ?? '-', clinic: '', therapist: tc?.therapist ?? '', queue: tc?.appointment.queue });
    if (e.type === 'approved' && l.planned) {
      // นัดตามแผน: ลงใหม่ / เลื่อน → เรียงรายการนัดใหม่ (นัดที่ใกล้ที่สุดขึ้นการ์ด)
      const date = isoToLabel(e.date);
      const no = (tc?.visits.length ?? 0) + 1 + Math.max(0, (plannedVisits[l.caseId] ?? []).findIndex((v) => v.id === ref));
      note(e.moved ? 'moved' : 'confirmed', e.moved ? `คลินิกเลื่อนนัดรักษา${tc?.short ?? ''} เป็น ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}` : `คลินิกนัดครั้งที่ ${no} ตามแผน ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
      syncPlanned.current();
    } else if (e.type === 'approved') {
      const date = isoToLabel(e.date);
      setCaseAppointment(l.caseId, { today: date === 'วันนี้', date, time: e.start, clinic: '', therapist: e.therapist });
      note('confirmed', `คลินิกยืนยันนัดรักษา${tc?.short ?? ''} ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
    } else if (e.type === 'moved' && l.planned) {
      // เลื่อนนัดตามแผน → เรียงรายการนัดใหม่
      note('moved', `คลินิกเลื่อนนัดรักษา${tc?.short ?? ''} เป็น ${isoToLabel(e.date)} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
      syncPlanned.current();
    } else if (e.type === 'moved') {
      const date = isoToLabel(e.date);
      setCaseAppts((m) => ({ ...m, [l.caseId]: { ...(m[l.caseId] ?? current()), today: date === 'วันนี้', date, time: e.start, therapist: e.therapist || m[l.caseId]?.therapist || '' } }));
      note('moved', `คลินิกเลื่อนนัดรักษา${tc?.short ?? ''} เป็น ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
    } else if (e.type === 'rejected') {
      setCaseAppts((m) => ({ ...m, [l.caseId]: { today: false, date: '-', time: '-', clinic: '', therapist: '' } }));
      note('rejected', `คลินิกไม่สามารถรับนัดรักษา${tc?.short ?? ''}${e.reason ? ` · ${e.reason}` : ''}`);
      delete bridgeRefs.current[ref];
    } else if (e.type === 'billVoid') {
      setBills((all) => all.filter((b) => b.id !== (l.billId ?? `b-${l.caseId}-${ref}`)));
      note('bill', `คลินิกยกเลิกใบเสร็จ${l.title ? ` ${l.title}` : ''} · รอชำระใหม่`);
    } else if (e.type === 'queue') {
      setCaseAppts((m) => ({ ...m, [l.caseId]: { ...(m[l.caseId] ?? current()), queue: e.queue || m[l.caseId]?.queue, stage: e.called ? 'called' : 'checked_in' } }));
      note('reminder', e.called ? `ถึงคิว${e.queue ? ` ${e.queue}` : 'คุณ'}แล้ว เชิญเข้ารับบริการ` : `เช็กอินแล้ว ได้คิว ${e.queue} · รอเรียกคิวในแอป`);
    } else if (e.type === 'started') {
      setCaseAppts((m) => ({ ...m, [l.caseId]: { ...(m[l.caseId] ?? current()), stage: 'in_service', startedAt: e.at } }));
      note('reminder', `เริ่มรับบริการแล้ว · รักษา${tc?.short ?? ''}`);
    } else if (e.type === 'completed' && !l.done) {
      // คลินิกบันทึกการนวด → ครั้งใหม่ของใบนี้ (คะแนนของคลินิก) · บิลจริงตามมาจากคลินิก
      const no = (tc?.visits.length ?? 0) + 1;
      clinicCloseVisit({ caseId: l.caseId }, e.painAfter, { bill: false });
      setLink({ ...l, done: true, billId: `b-${l.caseId}-${no}`, title: `รักษา${tc?.short ?? ''} ครั้งที่ ${no}` });
      // นวดครั้งนี้แล้ว → นัดตามแผนถัดไปขึ้นการ์ด
      setTimeout(() => syncPlanned.current(), 400);
      if (e.record?.advice) note('followup', `คำแนะนำจากผู้ให้บริการ: ${e.record.advice}`);
    } else if (e.type === 'bill') {
      const billId = l.billId ?? `b-${l.caseId}-${ref}`;
      setBills((all) => {
        const prev = all.find((b) => b.id === billId);
        const title = prev?.title ?? l.title ?? `รักษา${tc?.short ?? ''}`;
        return [{ id: billId, caseId: l.caseId, title, date: prev?.date ?? 'วันนี้', items: e.lines?.length ? e.lines : [{ name: e.items.join(' + ') || 'ค่าบริการ', amount: e.amount }], total: e.amount, status: 'pending', cloudRef: ref, receiptNo: e.receiptNo }, ...all.filter((b) => b.id !== billId)];
      });
      note('bill', `บิล${l.title ?? `รักษา${tc?.short ?? ''}`} รอชำระ ${e.amount} บาท`, billId);
    } else if (e.type === 'receipt') {
      const billId = l.billId ?? `b-${l.caseId}-${ref}`;
      const method = asMethod(e.method);
      setBills((all) => all.map((b) => (b.id === billId ? { ...b, status: 'paid', paidAt: e.quiet ? b.paidAt : nowAtLabel(), receiptNo: e.receiptNo ?? b.receiptNo, method: method ?? b.method, therapist: e.therapist || b.therapist } : b)));
      if (!e.quiet) note('receipt', `ชำระที่คลินิกแล้ว ${e.amount} บาท${e.receiptNo ? ` · ใบเสร็จ ${e.receiptNo}` : ''}`, billId);
    } else if (e.type === 'cancelled' || e.type === 'absent') {
      setCaseAppts((m) => ({ ...m, [l.caseId]: { today: false, date: '-', time: '-', clinic: '', therapist: '' } }));
      if (l.planned) setTimeout(() => syncPlanned.current(), 400);
      note(e.type === 'absent' ? 'noshow' : 'cancelled', e.type === 'absent' ? `คลินิกบันทึกว่าไม่มาตามนัด รักษา${tc?.short ?? ''}` : `คลินิกยกเลิกนัดรักษา${tc?.short ?? ''}${e.reason ? ` · ${e.reason}` : ''}`);
      if (bridgeRefs.current[ref]?.caseBooking) delete bridgeRefs.current[ref];
    }
  };
  /**
   * หลังบ้านลบนัด (ล้างข้อมูลผู้ป่วย/ล้างทั้งหมด) → แอปเอาออกตาม
   * นัดแรกของเรื่องที่รักษา = ทั้งเรื่อง (แท็บ ผล บิล แจ้งเตือน) · นัดครั้งถัดไป = นัดนั้น · ใบร่างที่จองไว้ = กลับเป็นประเมินแล้วยังไม่จอง (ผลประเมินเป็นของผู้ใช้)
   * ยกเลิก/ปฏิเสธ (เปลี่ยนสถานะ) ไม่ใช่การลบ → ยังแสดงตามเดิม
   */
  const removeCase = (caseId: string) => {
    const drop = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== caseId));
    setPromoted((cs) => cs.filter((c) => c.id !== caseId));
    setCaseAppts(drop);
    setCaseVisits(drop);
    setSelfPains(drop);
    setPlannedVisits(drop);
    setCaseTodayState(drop);
    setVisitRecords((m) => Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith(`${caseId}:`))));
    setBills((all) => all.filter((b) => b.caseId !== caseId));
    setApptNotices((all) => all.filter((n) => n.caseId !== caseId));
    delete pendingPre.current[caseId];
    for (const k of Object.keys(caseLinks.current)) if (caseLinks.current[k].caseId === caseId) delete caseLinks.current[k];
    for (const k of Object.keys(bridgedCase.current)) if (bridgedCase.current[k] === caseId) delete bridgedCase.current[k];
  };
  const onDeleted = (ref: string) => {
    const t = bridgeRefs.current[ref];
    const l = caseLinks.current[ref];
    const label = t?.title ?? t?.label ?? l?.title ?? 'นัด';
    // เรื่องที่เกิดจากนัดนี้ (นวดครั้งแรกแล้ว) → ลบทั้งเรื่อง
    const origin = t?.draftId ? `case-${t.draftId}` : t && !t.caseBooking ? t.caseId : undefined;
    const caseId = l?.caseId ?? (t?.caseBooking ? t.caseId : undefined);
    if (origin && promotedRef.current.some((c) => c.id === origin)) removeCase(origin);
    else if (caseId) {
      // นัดครั้งถัดไปของเรื่องที่รักษา → ไม่มีนัดแล้ว
      setCaseAppts((m) => ({ ...m, [caseId]: { today: false, date: '-', time: '-', clinic: m[caseId]?.clinic ?? '', therapist: m[caseId]?.therapist ?? '' } }));
      if (l?.planned) setTimeout(() => syncPlanned.current(), 400);
    }
    if (t?.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId ? { ...d, booking: undefined, stage: 'assessed' } : d)));
    if (t?.looseId) setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
    delete bridgeRefs.current[ref];
    delete caseLinks.current[ref];
    if (t || l) setApptNotices((all) => [{ id: `n-del-${ref}`, kind: 'cancelled', text: `คลินิกลบข้อมูล${label}ออกจากระบบแล้ว`, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-del-${ref}`)]);
  };
  onClinic.current = (events) => {
    // ทุกความเปลี่ยนแปลงจากคลินิก → อ่านคอร์สใหม่ (ใช้ไปกี่ครั้ง)
    if (events.length) refreshCourse();
    for (const e of events) {
      if (e.type === 'deleted') {
        onDeleted(e.ref);
        continue;
      }
      if ('ref' in e && caseLinks.current[e.ref]) {
        onCaseEvent(e.ref, caseLinks.current[e.ref], e);
        continue;
      }
      // นัดครั้งถัดไปของเรื่องที่รักษาอยู่ (จองในแอป · บัญชีจริง)
      const cb = 'ref' in e ? bridgeRefs.current[e.ref] : undefined;
      if (cb?.caseBooking && cb.caseId && 'ref' in e) {
        onCaseEvent(e.ref, { caseId: cb.caseId, billId: cb.billId, done: cb.done, title: cb.title }, e);
        continue;
      }
      // นัดที่แอปยังไม่รู้จัก (คลินิกลงเองตามแผน) → อยู่ในเรื่องที่รักษาเดิม (1 การรักษา = 1 แท็บ) ดึงนัดของผู้ป่วยใหม่ แล้วแจ้งเตือน
      if (e.type === 'approved' && !bridgeRefs.current[e.ref] && caseFor(patientOf().id)) {
        const ref = e.ref;
        setTimeout(() => {
          syncPlanned.current();
          setTimeout(() => {
            const l = caseLinks.current[ref];
            if (l?.planned) onCaseEvent(ref, l, e);
          }, 1200);
        }, 0);
        continue;
      }
      if (e.type === 'plan') {
        const caseId = caseFor(e.patientId);
        if (caseId) applyPlan(caseId, e);
        else pendingPlan.current[e.patientId] = e;
        continue;
      }
      if (e.type === 'visit') {
        // นวดครั้งต่อไปตามแผน → ครั้งใหม่ของเรื่องนั้น (คะแนนหลังนวดของคลินิก + บิล)
        const caseId = caseFor(e.patientId);
        if (caseId) clinicCloseVisit({ caseId }, e.painAfter);
        continue;
      }
      // คลินิกลงนัดให้ (คอร์ส) ระหว่างที่จองครั้งแรกไว้แล้วแต่ยังไม่ได้นวด → ครั้งถัดไปของการรักษาเดิม (ไม่เปิดแท็บใหม่)
      const held = e.type === 'approved' && e.byClinic && !bridgeRefs.current[e.ref] && e.patientId === patientOf().id ? bookedFor(e.patientId) : undefined;
      if (held && e.type === 'approved') {
        const date = isoToLabel(e.date);
        const target = held.draftId ? { draftId: held.draftId } : { looseId: held.looseId };
        setApptNotices((all) => [{ id: `n-cl-${e.id}`, ...target, kind: 'confirmed', text: e.course ? `คลินิกลงนัดคอร์ส${e.course.name} ครั้งที่ ${e.course.no}/${e.course.total} · ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''} · อยู่ในการรักษาเดิม` : `คลินิกลงนัดครั้งถัดไปให้ ${date} ${e.start}`, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-cl-${e.id}`)]);
        setTimeout(() => syncPlanned.current(), 300);
        refreshCourse();
        continue;
      }
      // คลินิกลงนัดให้เอง แต่ยังไม่มีเรื่องที่รักษาในแอป → นัดใหม่ (เรื่องใหม่ 1 แท็บ) · มีเรื่องแล้ว = นัดตามแผนของเรื่องนั้น (ด้านบน)
      if (e.type === 'approved' && e.byClinic && !bridgeRefs.current[e.ref] && e.patientId === patientOf().id) {
        const looseId = `lc-${e.ref}`;
        const date = isoToLabel(e.date);
        const title = e.course ? `คอร์ส${e.course.name}` : 'นัดจากคลินิก';
        const av = readAvailability();
        const clinic = av?.clinic?.name ?? av?.clinicName ?? 'คลินิก';
        setLooseBookings((all) => (all.some((b) => b.id === looseId) ? all : [...all, { id: looseId, date, iso: e.date, time: e.start, service: e.service, therapist: e.therapist, clinic, visit: e.course?.no ?? 1, status: 'confirmed', course: e.course }]));
        bridgeRefs.current[e.ref] = { looseId, label: `${date} ${e.start}`, patientId: e.patientId, title, course: true };
        setApptNotices((all) => [{ id: `n-cl-${e.id}`, looseId, kind: 'confirmed', text: e.course ? `คลินิกลงนัด${title} ครั้งที่ ${e.course.no}/${e.course.total} · ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}` : `คลินิกลงนัดให้ ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`, at: nowAtLabel() }, ...all.filter((n) => n.id !== `n-cl-${e.id}`)]);
        refreshCourse();
        continue;
      }
      const t = bridgeRefs.current[e.ref];
      if (!t) continue;
      const target = { draftId: t.draftId, looseId: t.looseId };
      const unbook = () => {
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId ? { ...d, booking: undefined, stage: 'assessed' } : d)));
        if (t.looseId) setLooseBookings((all) => all.filter((b) => b.id !== t.looseId));
      };
      // นัดที่จบแล้ว (ปฏิเสธ/นวดเสร็จ/ยกเลิก) ถูกเอาออก → แจ้งเตือนไม่ผูกกับนัดนั้น (ไม่อย่างนั้นถูกกรองทิ้ง)
      const note = (kind: ApptNotice['kind'], text: string) => setApptNotices((all) => [{ id: `n-${e.type}-${e.id}`, ...(e.type === 'approved' ? target : {}), kind, text, at: nowAtLabel() }, ...all]);
      if (e.type === 'checkinRejected') {
        // เช็กอินไม่ผ่าน → หน้าเช็กอินบอกเหตุผลให้สแกนใหม่
        setCheckinErrors((m) => ({ ...m, [e.ref]: e.reason }));
        note('reminder', `เช็กอินไม่สำเร็จ · ${e.reason}`);
        continue;
      }
      if (e.type === 'queue') {
        setCheckinErrors((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== e.ref)));
        // คลินิกออกเลขคิว (หลังเช็กอิน) / เรียกคิว → แสดงที่นัด + แจ้งเตือน
        const withQueue = (b: Booking): Booking => ({ ...b, queue: e.queue || b.queue, stage: e.called ? 'called' : 'checked_in' });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: withQueue(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...withQueue(b), id: b.id } : b)));
        note('reminder', e.called ? `ถึงคิว${e.queue ? ` ${e.queue}` : 'คุณ'}แล้ว เชิญเข้ารับบริการ` : `เช็กอินแล้ว ได้คิว ${e.queue} · รอเรียกคิวในแอป`);
        continue;
      }
      if (e.type === 'moved') {
        // คลินิกเลื่อนนัด → วัน/เวลา/ผู้ให้บริการใหม่
        const date = isoToLabel(e.date);
        const move = (b: Booking): Booking => ({ ...b, date, iso: e.date, time: e.start, therapist: e.therapist || b.therapist, service: e.service || b.service });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: move(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...move(b), id: b.id } : b)));
        setApptNotices((all) => [{ id: `n-moved-${e.id}`, ...target, kind: 'moved', text: `คลินิกเลื่อนนัดเป็น ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`, at: nowAtLabel() }, ...all]);
        continue;
      }
      if (e.type === 'billVoid') {
        // คลินิกยกเลิกใบเสร็จ → บิลเดิมหายไป รอบิลใหม่ (คืนเงินตามที่คลินิกแจ้ง)
        setBills((all) => all.filter((b) => b.id !== `cb-${e.ref}`));
        note('bill', `คลินิกยกเลิกใบเสร็จ ${t.title ?? t.label} · รอชำระใหม่`);
        continue;
      }
      if (e.type === 'started') {
        const started = (b: Booking): Booking => ({ ...b, stage: 'in_service', startedAt: e.at });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: started(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...started(b), id: b.id } : b)));
        note('reminder', `เริ่มรับบริการแล้ว ${t.label}`);
        continue;
      }
      if (e.type === 'bill' || e.type === 'receipt') {
        // คลินิกส่งบิล / ใบเสร็จ (จ่ายที่คลินิก) — ยังไม่ได้ผลการนวดมาก่อน → ปิดการรักษาให้ก่อน
        const caseId = t.caseId ?? closeFromClinic(e.ref, t, undefined, { bill: false });
        const title = `${t.title ?? t.label} ครั้งที่ 1`;
        const billId = `cb-${e.ref}`;
        if (e.type === 'bill') {
          setBills((all) => [{ id: billId, caseId, title, date: 'วันนี้', items: e.lines?.length ? e.lines : [{ name: e.items.join(' + ') || 'ค่าบริการ', amount: e.amount }], total: e.amount, status: 'pending', cloudRef: e.ref, receiptNo: e.receiptNo, therapist: e.therapist }, ...all.filter((b) => b.id !== billId)]);
          setApptNotices((all) => [{ id: `n-${e.id}`, caseId, kind: 'bill', billId, text: `บิล${title} รอชำระ ${e.amount} บาท`, at: nowAtLabel() }, ...all]);
        } else {
          const paid = { status: 'paid' as const, receiptNo: e.receiptNo, method: asMethod(e.method), therapist: e.therapist };
          const items = e.lines?.length ? e.lines : undefined;
          setBills((all) =>
            all.some((b) => b.id === billId)
              ? all.map((b) => (b.id === billId ? { ...b, ...paid, items: items ?? b.items, paidAt: e.quiet ? b.paidAt : nowAtLabel(), method: paid.method ?? b.method, therapist: paid.therapist || b.therapist, receiptNo: paid.receiptNo ?? b.receiptNo } : b))
              : [{ id: billId, caseId, title, date: 'วันนี้', items: items ?? [{ name: 'ค่าบริการ', amount: e.amount }], total: e.amount, cloudRef: e.ref, ...paid, paidAt: nowAtLabel() }, ...all],
          );
          if (!e.quiet) setApptNotices((all) => [{ id: `n-${e.id}`, caseId, kind: 'receipt', billId, text: `ชำระที่คลินิกแล้ว ${e.amount} บาท · ใบเสร็จ${title}`, at: nowAtLabel() }, ...all]);
        }
        continue;
      }
      if (e.type === 'approved') {
        // คลินิกอาจย้ายวัน/เวลา/ผู้ให้บริการ → ใช้ค่าที่คลินิกยืนยัน · cloud: เลขคิวมาจากคลินิกตอนเช็กอิน (ไม่ออกเอง)
        const date = isoToLabel(e.date);
        const confirm = (b: Booking): Booking => ({ ...b, date, time: e.start, therapist: e.therapist || b.therapist, service: e.service || b.service, status: 'confirmed', queue: e.cloud ? b.queue : date === 'วันนี้' ? `A${++queueNo.current}` : undefined });
        if (t.draftId) setDrafts((all) => all.map((d) => (d.id === t.draftId && d.booking ? { ...d, booking: confirm(d.booking) } : d)));
        if (t.looseId) setLooseBookings((all) => all.map((b) => (b.id === t.looseId ? { ...confirm(b), id: b.id } : b)));
        note('confirmed', `คลินิกยืนยันนัด ${date} ${e.start}${e.therapist ? ` · ${e.therapist}` : ''}`);
      } else if (e.type === 'rejected') {
        unbook();
        note('rejected', `คลินิกไม่สามารถรับนัด ${t.label}${e.reason ? ` · ${e.reason}` : ''}`);
      } else if (e.type === 'completed') {
        // นวดเสร็จ: ใบร่าง → ใบการรักษา (คะแนนหลังนวดของคลินิก + บิล) · นัดเรื่องใหม่ที่ยังไม่ประเมิน → ปิดนัด
        const caseId = closeFromClinic(e.ref, t, e, e.cloud ? { bill: false, diagnosis: e.record?.diagnoses?.[0], record: e.record } : undefined);
        // ผลการรักษาจากคลินิก (cloud): คำแนะนำหลังนวด → แจ้งเตือน
        if (e.cloud && e.record?.advice) note('followup', `คำแนะนำจากผู้ให้บริการ: ${e.record.advice}`);
        if (caseId && t.patientId) {
          bridgedCase.current[t.patientId] = caseId;
          // แผนที่คลินิกลงไว้ก่อน → ใส่ให้เรื่องนี้ (รอ state ของเรื่องใหม่เข้าที่)
          const pp = pendingPlan.current[t.patientId];
          if (pp) {
            delete pendingPlan.current[t.patientId];
            setTimeout(() => onClinic.current([pp]), 300);
          }
        }
      } else {
        unbook();
        note(e.type === 'absent' ? 'noshow' : 'cancelled', e.type === 'absent' ? `คลินิกบันทึกว่าไม่มาตามนัด ${t.label}` : `คลินิกยกเลิกนัด ${t.label}${e.reason ? ` · ${e.reason}` : ''}`);
      }
      // อนุมัติแล้วยังรอผลการนวด → จำไว้ · cloud: นวดเสร็จแล้วยังมีบิล/ใบเสร็จ/แผนตามมา → จำต่อ · จบแล้ว (ปฏิเสธ/ยกเลิก) → ลบ
      if (e.type !== 'approved' && !(e.type === 'completed' && e.cloud)) delete bridgeRefs.current[e.ref];
    }
  };

  /** เข้าใช้งานแล้ว (ถึงหน้าแรก) → เปิดใหม่กลับมาที่เดิม */
  const [entered, setEntered] = useState(() => !!savedState()?.entered);
  const markEntered = useCallback(() => setEntered(true), []);
  React.useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => {
      try {
        setItem(
          APP_STATE_KEY,
          JSON.stringify({
            entered, profile, consents, elements, elementsDone, followUps, account, newPatient, careStage, looseBookings, lastAssess, drafts, activeDraftId, promoted,
            cancelledAppts, caseAppts, plannedVisits, caseVisits, selfPains, visitRecords, caseToday, apptNotices, bills, queueNo: queueNo.current,
            bridgeRefs: bridgeRefs.current, bridgedCase: bridgedCase.current, pendingPlan: pendingPlan.current, pendingPre: pendingPre.current,
          }),
        );
      } catch {
        /* storage full / unavailable */
      }
    }, 300);
    return () => clearTimeout(t);
  });
  /* ---------- บัญชีจริง: ข้อมูลในแอปบันทึกกับบัญชี (tw_app_state) — ปิด/เปิดแอป เปลี่ยนเครื่อง ข้อมูลยังอยู่ ---------- */
  const [clinicHn, setClinicHn] = useState<string | null>(null);
  clinicHnRef.current = clinicHn;
  const restoredFor = React.useRef<string | null>(null);
  const [restoredTick, setRestoredTick] = useState(0);
  /* เข้าระบบ/เปิดแอปแล้วดึงข้อมูลบัญชีกลับมา → ตรวจนัดทุกนัดที่แอปผูกไว้กับหลังบ้าน
   * หลังบ้านลบไประหว่างที่ออกจากระบบ/ปิดแอป (ไม่ได้รับเหตุการณ์ลบตอนนั้น) → เอาออกตาม (เรื่อง · นัด · ใบร่างกลับเป็นยังไม่จอง) */
  React.useEffect(() => {
    if (!restoredTick || !isCloud()) return;
    const ids = [...new Set([...Object.keys(bridgeRefs.current), ...Object.keys(caseLinks.current)])].filter((id) => !id.startsWith('local-'));
    if (!ids.length) return;
    void missingAppointments(ids).then((gone) => gone?.forEach((id) => onDeleted(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredTick]);
  /* หลังบ้านล้างข้อมูลผู้ป่วยนี้ (ลบนัด/ประวัติ) → ในแอปล้างตาม ให้ตรงกับหลังบ้าน · ล้างครั้งละ 1 รอบต่อคำสั่ง (resetSeen)
   * ล้างเฉพาะผู้ป่วย = นัด เรื่องที่รักษา บิล แจ้งเตือน (ผลประเมินที่ยังไม่จองยังอยู่) · ล้างทั้งระบบ = เหมือนเพิ่งเริ่มใช้ */
  React.useEffect(() => {
    if (!restoredTick || !clinicReset || clinicReset.at === resetSeen.current) return;
    resetSeen.current = clinicReset.at;
    bridgeRefs.current = {};
    bridgedCase.current = {};
    caseLinks.current = {};
    pendingPlan.current = {};
    setLooseBookings([]);
    setPromoted([]);
    setCancelledAppts([]);
    setCaseAppts({});
    setCaseVisits({});
    setCaseTodayState({});
    setVisitRecords({});
    setPlannedVisits({});
    setFollowUps([]);
    setApptNotices([]);
    setBills([]);
    setCareStage('new');
    if (clinicReset.all) {
      // รีเซ็ตทั้งระบบ: เหมือนเพิ่งเริ่มใช้แอป — ล้างข้อมูลสุขภาพ ธาตุ ประวัติ (บัญชี/การเข้าสู่ระบบยังอยู่)
      setDrafts([]);
      setActiveDraftId(null);
      setLastAssess(null);
      setSelfPains({});
      setProfile((pf) => ({ ...pf, flags: Object.fromEntries(Object.keys(pf.flags ?? {}).map((k) => [k, false])) as typeof pf.flags, conditions: [], medications: [], allergies: [], healthKnown: false, conditionsKnown: false, medicationsKnown: false, allergiesKnown: false, phrSource: undefined, pregnant: false, surgeryWithin1Month: false, injuryWithin48h: false, bp: undefined, temperature: undefined, pulse: undefined }));
      setElementsDone(false);
      setNewPatient(true);
      setAudit([]);
      setClinicCourse(null);
      setClinicVisits([]);
    } else setDrafts((all) => all.map((d) => (d.booking || d.stage !== 'assessed' ? { ...d, booking: undefined, stage: 'assessed' } : d)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredTick, clinicReset]);
  // สำรอง: ตรวจคอร์ส/สัญญาณล้างข้อมูลจากคลินิกทุก 20 วินาที (ล้างข้อมูลในคลินิกไม่มีเหตุการณ์ส่งมา)
  React.useEffect(() => {
    if (!account?.userId || !isCloud()) return;
    const t = setInterval(refreshCourse, 20000);
    return () => clearInterval(t);
  }, [account?.userId, refreshCourse]);
  const persisted = { profile, consents, elements, elementsDone, careStage, looseBookings, lastAssess, drafts, activeDraftId, promoted, cancelledAppts, caseAppts, caseVisits, selfPains, caseToday, apptNotices, bills, followUps, audit, visitRecords };
  const uid = account?.userId;
  React.useEffect(() => {
    restoredFor.current = null;
    resetSeen.current = null;
    setClinicReset(null);
    setClinicHn(null);
    if (!uid || !isCloud()) {
      // ไม่มีบัญชีจริง → ฟังนัดตามที่จำไว้ในเครื่อง
      if (isCloud()) startLocalSync();
      else stopAccountSync();
      return;
    }
    let alive = true;
    void loadAppState(uid).then((st) => {
      if (!alive) return;
      if (st) {
        const set: Record<string, (v: never) => void> = { profile: setProfile, consents: setConsents, elements: setElementsState, elementsDone: setElementsDone, careStage: setCareStage, looseBookings: setLooseBookings, lastAssess: setLastAssess, drafts: setDrafts, activeDraftId: setActiveDraftId, promoted: setPromoted, cancelledAppts: setCancelledAppts, caseAppts: setCaseAppts, caseVisits: setCaseVisits, selfPains: setSelfPains, caseToday: setCaseTodayState, visitRecords: setVisitRecords, apptNotices: setApptNotices, bills: setBills, followUps: setFollowUps, audit: setAudit };
        for (const [k, fn] of Object.entries(set)) if (k in st) fn(st[k] as never);
        bridgeRefs.current = (st.bridgeRefs as typeof bridgeRefs.current) ?? {};
        bridgedCase.current = (st.bridgedCase as typeof bridgedCase.current) ?? {};
        caseLinks.current = (st.caseLinks as typeof caseLinks.current) ?? {};
        resetSeen.current = (st.resetSeen as string | undefined) ?? null;
      } else {
        // บัญชีใหม่: ไม่มีบิล/แจ้งเตือน/ประวัติตัวอย่าง
        setBills([]);
        setApptNotices([]);
        setAudit([]);
      }
      restoredFor.current = uid;
      setRestoredTick((n) => n + 1);
      // เทียบนัดใน cloud กับที่เคยเห็น → ได้เหตุการณ์ระหว่างปิดแอป (ยืนยัน เรียกคิว บิล ฯลฯ)
      startAccountSync((st?.seen as Record<string, CloudRow>) ?? {});
    });
    void fetchMyHn(uid).then((hn) => alive && setClinicHn(hn));
    setClinicCourse(null);
    setClinicVisits([]);
    refreshCourse();
    // ระยะทางจริงไปคลินิก (ขอสิทธิ์ตำแหน่งครั้งแรก)
    void locate();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  React.useEffect(() => {
    if (!uid || restoredFor.current !== uid) return;
    const t = setTimeout(() => {
      void saveAppState(uid, { ...persisted, bridgeRefs: bridgeRefs.current, bridgedCase: bridgedCase.current, caseLinks: caseLinks.current, resetSeen: resetSeen.current, seen: seenRows() }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, restoredTick, ...Object.values(persisted)]);
  // คลินิกออก HN ให้ตอนรับคำขอจองครั้งแรก → ดึงมาแสดงในโปรไฟล์
  React.useEffect(() => {
    if (uid && !clinicHn && apptNotices.length) void fetchMyHn(uid).then((hn) => hn && setClinicHn(hn));
  }, [uid, clinicHn, apptNotices.length]);

  const value: JourneyState = {
    resumed: !!savedState()?.entered,
    markEntered,
    client: account
      ? { name: `คุณ${account.name}`, initials: account.name.slice(0, 2), age: profile.age, occupation: '', hn: clinicHn ?? (account.userId ? 'รอคลินิกออก HN' : 'TW-NEW') }
      : { name: 'คุณสมศักดิ์ รักดี', initials: 'สศ', age: profile.age, occupation: 'พนักงานออฟฟิศ', hn: 'TW-000123' },
    scenario,
    setScenario,
    consents,
    setConsents,
    profile,
    setProfile,
    symptoms,
    setSymptoms,
    chiefComplaint,
    setChiefComplaint,
    goal,
    setGoal,
    before,
    setBefore,
    after,
    setAfter,
    safety,
    acknowledged,
    setAcknowledged,
    record,
    setRecord,
    elements,
    setElements,
    elementsDone,
    audit,
    log,
    followUps,
    sendFollowUp,
    reset,
    account,
    setAccount,
    newPatient,
    setNewPatient,
    careStage,
    setCareStage,
    looseBookings,
    addLooseBooking,
    updateLooseBooking,
    removeLooseBooking,
    lastAssess,
    setLastAssess,
    drafts,
    upsertDraft,
    removeDraft,
    activeDraftId,
    setActiveDraftId,
    promoted,
    promoteDraft,
    cancelledAppts,
    cancelAppointment,
    caseAppts,
    plannedVisits,
    setCaseAppointment,
    signOut,
    cases,
    recordCaseVisit,
    clinicCloseVisit,
    notifyClinic,
    setVisitSelfPain,
    issueQueue,
    caseToday,
    setCaseToday,
    addSymptomNote,
    // แจ้งเตือนเฉพาะเรื่องที่มีอยู่จริงของคนนี้ (คนใหม่ไม่เห็นของคนไข้ตัวอย่าง)
    apptNotices: apptNotices.filter((n) => (n.caseId ? cases.some((c) => c.id === n.caseId) : n.draftId ? drafts.some((d) => d.id === n.draftId) : n.looseId ? looseBookings.some((b) => b.id === n.looseId) : true)),
    dismissNotice,
    markAllNoticesRead,
    // บิลเฉพาะเรื่องของคนนี้ (คนใหม่ไม่เห็นของคนไข้ตัวอย่าง)
    bills: bills.filter((b) => !b.caseId || cases.some((c) => c.id === b.caseId)),
    // คอร์สจากข้อมูลผู้ป่วยในคลินิก · ยังไม่มี แต่คลินิกลงนัดตามคอร์สไว้แล้ว → คอร์สจากนัดนั้น (ชื่อ · จำนวนครั้ง · ใช้ไป = ครั้งที่ของนัดแรก − 1)
    clinicCourse: clinicCourse ?? courseOfRows(),
    clinicVisits,
    payBill,
    requestBooking,
    bookCase,
    checkIn,
    checkinErrors,
    cancelBooking,
    cloudRefOf,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useJourney must be used inside <JourneyProvider>');
  return c;
}

/** ประวัติผลลัพธ์ย้อนหลัง (Longitudinal) — mock */
export const HISTORY = [
  { date: '14 มิ.ย.', label: 'ครั้งที่ 1', painBefore: 8, painAfter: 6, plan: 'นวดเพื่อผ่อนคลาย 90 น.' },
  { date: '28 มิ.ย.', label: 'ครั้งที่ 2', painBefore: 8, painAfter: 5, plan: 'นวดราชสำนัก 60 น.' },
  { date: '12 ก.ค.', label: 'ครั้งที่ 3', painBefore: 7, painAfter: 5, plan: 'นวดราชสำนัก 60 น.' },
  { date: '2 ส.ค.', label: 'ครั้งที่ 4', painBefore: 7, painAfter: 4, plan: 'นวดเฉพาะส่วน + ประคบ' },
  { date: '16 ส.ค.', label: 'ครั้งที่ 5', painBefore: 6, painAfter: 4, plan: 'นวดราชสำนัก 60 น.' },
  { date: '30 ส.ค.', label: 'ครั้งที่ 6', painBefore: 6, painAfter: 3, plan: 'นวดราชสำนัก 60 น.' },
];
