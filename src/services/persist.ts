/**
 * ที่จำข้อมูลของแอปบนเครื่อง (ต้นแบบ) — เว็บ: localStorage · มือถือ: AsyncStorage
 * ------------------------------------------------------------------
 * อ่านแบบทันที (sync) ได้ทั้งสองแบบ: มือถือโหลดค่าทั้งหมดเข้าหน่วยความจำก่อนแสดงแอป (hydratePersist) แล้วเขียนกลับแบบเบื้องหลัง
 */
import { Platform } from 'react-native';
import type AsyncStorageType from '@react-native-async-storage/async-storage';

/** แอปที่บิวด์ก่อนเพิ่มที่เก็บนี้ (ไม่มี native module) → ไม่ล่ม แค่ไม่จำข้อมูล */
const AsyncStorage: typeof AsyncStorageType | null = (() => {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
})();

const web = Platform.OS === 'web';
const cache = new Map<string, string>();

const webStore = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** มือถือ: โหลดค่าที่จำไว้เข้าหน่วยความจำ (เรียกครั้งเดียวก่อนแสดงแอป) */
export async function hydratePersist(keys: string[]) {
  if (web || !AsyncStorage) return;
  try {
    for (const [k, v] of await AsyncStorage.multiGet(keys)) if (v != null) cache.set(k, v);
  } catch {
    /* ไม่มีที่เก็บ → เริ่มใหม่ */
  }
}

export function getItem(key: string): string | null {
  if (web) return webStore()?.getItem(key) ?? null;
  return cache.get(key) ?? null;
}

export function setItem(key: string, value: string) {
  if (web) return webStore()?.setItem(key, value);
  cache.set(key, value);
  void AsyncStorage?.setItem(key, value).catch(() => undefined);
}

export function removeItem(key: string) {
  if (web) return webStore()?.removeItem(key);
  cache.delete(key);
  void AsyncStorage?.removeItem(key).catch(() => undefined);
}
