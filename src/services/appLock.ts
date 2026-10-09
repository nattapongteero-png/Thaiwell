/**
 * ล็อกแอป (ข้อมูลสุขภาพ = ข้อมูลอ่อนไหว): เปิดแอป / กลับเข้าแอปหลังทิ้งไว้เกิน LOCK_AFTER_MS → Face ID หรือ PIN 6 หลัก
 * PIN เก็บเฉพาะในเครื่อง (Keychain ผ่าน SecureStore) เป็นค่า hash ผูกกับบัญชี — ไม่ส่งขึ้นคลาวด์
 * เว็บ (ต้นแบบ/เดโม) ไม่ล็อก
 */
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const LOCK_AFTER_MS = 5 * 60 * 1000;
export const PIN_LENGTH = 6;
/** ใส่ PIN ผิดครบเท่านี้ → ต้องเข้าสู่ระบบด้วยรหัสผ่าน */
export const PIN_TRIES = 5;
export const lockSupported = Platform.OS !== 'web';

const PIN_KEY = 'thaiwell.pin.v1';
const hash = (userId: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${userId}:${pin}`);

/** บัญชีนี้ตั้ง PIN ในเครื่องนี้แล้วหรือยัง */
export async function hasPin(userId: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PIN_KEY);
    return !!raw && (JSON.parse(raw) as { userId: string }).userId === userId;
  } catch {
    return false;
  }
}

export async function setPin(userId: string, pin: string) {
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ userId, hash: await hash(userId, pin) }));
}

export async function checkPin(userId: string, pin: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PIN_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { userId: string; hash: string };
    return saved.userId === userId && saved.hash === (await hash(userId, pin));
  } catch {
    return false;
  }
}

export async function clearPin() {
  if (!lockSupported) return;
  await SecureStore.deleteItemAsync(PIN_KEY).catch(() => undefined);
}

/** เครื่องนี้มี Face ID / Touch ID ที่ตั้งไว้แล้วไหม */
export async function biometricReady(): Promise<boolean> {
  if (!lockSupported) return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** สแกน Face ID — ไม่ให้ใช้รหัสเครื่องแทน (ใช้ PIN ของแอปแทน) */
export async function biometricUnlock(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'ปลดล็อก ThaiWell AI', cancelLabel: 'ใช้ PIN', disableDeviceFallback: true });
    return r.success;
  } catch {
    return false;
  }
}
