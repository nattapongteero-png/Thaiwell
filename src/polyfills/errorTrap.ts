/**
 * ต้นแบบ: JS error ที่ไม่มีใครจับ → แสดงข้อความแทนการปิดแอป
 * แอปที่ลงเครื่อง (release) เจอ error แบบนี้แล้ว React Native ปิดแอปทันที และข้อความ error หายระหว่างทาง (ดูจาก crash log ไม่ได้)
 * → เก็บข้อความ + บรรทัดแรกของ stack ไว้ให้เห็นบนจอ (แก้ต้นเหตุได้ตรงจุด) · error ใน render ของหน้าจอยังไปที่ ErrorBoundary ตามปกติ
 */
import { Alert } from 'react-native';

type Handler = (error: unknown, isFatal?: boolean) => void;
const EU = (global as unknown as { ErrorUtils?: { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void } }).ErrorUtils;

if (EU && !__DEV__) {
  let shown = false;
  EU.setGlobalHandler((error) => {
    const e = error as { message?: string; stack?: string };
    const where = (e.stack ?? '').split('\n').slice(0, 4).join('\n');
    console.error('[ThaiWell] JS error', e.message, where);
    if (shown) return;
    shown = true;
    Alert.alert('เกิดข้อผิดพลาด', `${e.message ?? String(error)}\n\n${where}`, [{ text: 'ตกลง', onPress: () => (shown = false) }]);
  });
}
