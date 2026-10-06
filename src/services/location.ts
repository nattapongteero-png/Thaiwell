/**
 * ตำแหน่งของผู้ใช้ (ขออนุญาตก่อน) → ระยะทางจริงไปคลินิก · ไม่อนุญาต/หาไม่ได้ = ไม่แสดงระยะทาง
 */
import { Platform } from 'react-native';

export interface LatLng {
  lat: number;
  lng: number;
}
let here: LatLng | null = null;
let asked = false;
const listeners = new Set<() => void>();
export const myLocation = () => here;
export const onLocation = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** หาตำแหน่งครั้งเดียว (ถามสิทธิ์ครั้งแรก) */
export async function locate(): Promise<LatLng | null> {
  if (here || asked) return here;
  asked = true;
  try {
    if (Platform.OS === 'web') {
      here = await new Promise<LatLng | null>((resolve) =>
        navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 10000 }) : resolve(null),
      );
    } else {
      const Location = await import('expo-location');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.granted) {
        const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        here = { lat: p.coords.latitude, lng: p.coords.longitude };
      }
    }
  } catch {
    here = null;
  }
  listeners.forEach((l) => l());
  return here;
}

/** ระยะทางตรง (กม.) จากผู้ใช้ · ไม่รู้ตำแหน่ง = Infinity */
export function distanceKm(lat?: number, lng?: number) {
  if (!here || lat === undefined || lng === undefined) return Infinity;
  const R = 6371;
  const dLat = ((lat - here.lat) * Math.PI) / 180;
  const dLng = ((lng - here.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((here.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}
/** "1.2 กม." · คลินิกยังไม่ปักพิกัด / ผู้ใช้ไม่เปิดตำแหน่ง → บอกเหตุผล · อื่น ๆ (ไม่รู้) = "" */
export const kmText = (p: { km: number; lat?: number }) => {
  if (Number.isFinite(p.km)) return p.km < 1 ? `${Math.round(p.km * 1000)} ม.` : `${p.km} กม.`;
  if (p.lat !== undefined && !Number.isFinite(p.lat)) return 'คลินิกยังไม่ได้ปักตำแหน่ง';
  if (p.lat !== undefined && !here) return 'เปิดตำแหน่งเพื่อดูระยะทาง';
  return '';
};
