import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/** อ่านข้อความในรูปบนเครื่อง (iOS: Apple Vision ภาษาไทย+อังกฤษ) · ไม่มีโมดูล (เว็บ/Android) → null = ให้กรอกเอง */
const Native = Platform.OS === 'ios' ? requireOptionalNativeModule<{ recognize(uri: string): Promise<string[]> }>('IdCardOcr') : null;
export const ocrAvailable = !!Native;
export async function recognizeText(uri: string): Promise<string[] | null> {
  if (!Native) return null;
  return Native.recognize(uri);
}
