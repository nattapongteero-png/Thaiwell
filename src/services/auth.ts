/**
 * บัญชีผู้ใช้จริง (Supabase Auth · อีเมล + รหัสผ่าน)
 * ข้อมูลตามบัตรประชาชนและความยินยอมเก็บกับบัญชี (user metadata) → เข้าสู่ระบบเครื่องไหนก็ได้ข้อมูลเดิม
 */
import { cloud } from './cloudBridge';
import type { IdCard } from './idCard';

export interface CloudUser {
  id: string;
  email: string;
  identity?: IdCard & { verifiedAt: string; method: 'scan' | 'manual' };
  consents?: { service: boolean; aiProcessing: boolean; followUp: boolean; research: boolean };
  /** avatar ที่เลือก ("avatar:p12") */
  avatar?: string;
}

const TH_ERRORS: [RegExp, string][] = [
  [/EMAIL_NOT_FOUND/, 'ไม่พบบัญชีของอีเมลนี้ ตรวจอีเมลอีกครั้ง หรือสมัครบัญชี'],
  [/WRONG_PASSWORD/, 'รหัสผ่านไม่ถูกต้อง'],
  [/invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/already registered|already been registered|user already exists/i, 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบ'],
  [/password should be at least|weak password/i, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'],
  [/email not confirmed/i, 'ยังไม่ได้ยืนยันอีเมล เปิดลิงก์ในอีเมลที่ส่งไปก่อน'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'รูปแบบอีเมลไม่ถูกต้อง'],
  [/rate limit|too many/i, 'ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่'],
  [/network|fetch/i, 'เชื่อมต่ออินเทอร์เน็ตไม่ได้'],
];
export const thaiError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return TH_ERRORS.find(([re]) => re.test(msg))?.[1] ?? `ทำรายการไม่สำเร็จ (${msg})`;
};

const toUser = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined): CloudUser | null =>
  u ? { id: u.id, email: u.email ?? '', identity: u.user_metadata?.identity as CloudUser['identity'], consents: u.user_metadata?.consents as CloudUser['consents'], avatar: u.user_metadata?.avatar as string | undefined } : null;

/** บัญชีที่เข้าสู่ระบบค้างไว้ในเครื่อง (ไม่มี = null) */
export async function currentUser(): Promise<CloudUser | null> {
  const { data } = await cloud.auth.getSession();
  return toUser(data.session?.user);
}

/** สมัคร · needsConfirm = ต้องเปิดลิงก์ยืนยันในอีเมลก่อน (ตั้งค่า "Confirm email" ใน Supabase) */
export async function signUp(email: string, password: string): Promise<{ user: CloudUser | null; needsConfirm: boolean }> {
  const { data, error } = await cloud.auth.signUp({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  // อีเมลซ้ำ (เปิดยืนยันอีเมลไว้) Supabase ไม่ส่ง error แต่ identities ว่าง
  if (data.user && !data.session && (data.user.identities ?? []).length === 0) throw new Error('User already registered');
  return { user: toUser(data.session?.user ?? null), needsConfirm: !data.session };
}

/**
 * อีเมลนี้สมัครไว้หรือยัง (ฟังก์ชัน tw_email_registered ในฐานข้อมูล — docs/supabase/email-registered.sql)
 * ไม่มีฟังก์ชัน/เชื่อมต่อไม่ได้ = null (ไม่รู้)
 */
async function emailRegistered(email: string): Promise<boolean | null> {
  try {
    const { data, error } = await cloud.rpc('tw_email_registered', { p_email: email.trim().toLowerCase() });
    return error || typeof data !== 'boolean' ? null : data;
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { data, error } = await cloud.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) {
    // Supabase ตอบเหมือนกันทั้งอีเมลไม่มี/รหัสผิด → ถามว่าอีเมลนี้สมัครไว้ไหม เพื่อบอกให้ตรงจุด
    if (/invalid login credentials/i.test(error.message)) {
      const known = await emailRegistered(email);
      if (known === false) throw new Error('EMAIL_NOT_FOUND');
      if (known === true) throw new Error('WRONG_PASSWORD');
    }
    throw error;
  }
  return toUser(data.user)!;
}

export async function saveIdentity(identity: NonNullable<CloudUser['identity']>) {
  const { data, error } = await cloud.auth.updateUser({ data: { identity } });
  if (error) throw error;
  return toUser(data.user);
}

/** แก้เบอร์โทร → ข้อมูลยืนยันตัวตนของบัญชี (คงข้อมูลบัตรเดิม) + แถวผู้ป่วยของคลินิก (คลินิกติดต่อเบอร์ใหม่) */
export async function savePhone(userId: string, phone: string) {
  const { data: u, error: ge } = await cloud.auth.getUser();
  if (ge) throw ge;
  const identity = (u.user?.user_metadata as { identity?: Record<string, unknown> } | undefined)?.identity;
  if (identity) {
    const { error } = await cloud.auth.updateUser({ data: { identity: { ...identity, phone } } });
    if (error) throw error;
  }
  await cloud.from('tw_patients').update({ phone }).eq('user_id', userId);
}

export async function saveConsents(consents: NonNullable<CloudUser['consents']>) {
  const { error } = await cloud.auth.updateUser({ data: { consents } });
  if (error) throw error;
}

/** เปลี่ยน avatar → เก็บกับบัญชี + แถวผู้ป่วย (คลินิกเห็นรูปเดียวกัน) */
export async function saveAvatar(userId: string, avatar: string) {
  await cloud.auth.updateUser({ data: { avatar } });
  const { data } = await cloud.from('tw_patients').select('profile').eq('id', userId).maybeSingle();
  if (data) await cloud.from('tw_patients').update({ profile: { ...((data.profile as object) ?? {}), avatar } }).eq('id', userId);
}

export async function signOutCloud() {
  await cloud.auth.signOut().catch(() => undefined);
}
