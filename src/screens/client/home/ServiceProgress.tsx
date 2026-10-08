import React from 'react';
import { View } from 'react-native';
import { Text, radius, space, useTheme } from '../../../design-system';
import { serviceMinutesOf } from '../../../data/serviceMinutes';

/* กำลังรับบริการ: เวลาที่นวดไปแล้ว (เดินสด) · แถบความคืบหน้า เริ่ม → เสร็จประมาณ
 * เวลาเริ่ม = ตอนคลินิกกดเริ่มรับบริการ (จริง) · เสร็จประมาณ = เวลาเริ่ม + ระยะเวลาบริการ (คลินิกบันทึกเสร็จจึงได้เวลาจริง) */
/** นาฬิกาเดินทุกวินาทีขณะ active (เช่น กำลังรับบริการ) */
export function useNow(active: boolean) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}
/** ระยะเวลาบริการจากชื่อบริการ ("… · 90 นาที") · ไม่ระบุ = 60 นาที */
export const serviceMinutes = (label?: string) => serviceMinutesOf(label);
const clockOf = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** เวลาที่นวดไปแล้ว (mm:ss · เกินชั่วโมง = h:mm:ss) */
export const elapsedOf = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
/** กำลังรับบริการ: แถบความคืบหน้า เริ่ม → เสร็จประมาณ (เวลาเริ่มจริงจากคลินิก + ระยะเวลาบริการ) */
export function ServiceProgress({ startedAt, minutes }: { startedAt: string; minutes: number }) {
  const { colors } = useTheme();
  const now = useNow(true);
  const start = new Date(startedAt).getTime();
  const end = start + minutes * 60000;
  const frac = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return (
    <View style={{ gap: space[1] }}>
      <View style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
        <View style={{ width: `${frac * 100}%`, height: '100%', borderRadius: radius.full, backgroundColor: colors.brand.primary }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodyXs" tone="secondary">
          เริ่ม {clockOf(start)}
        </Text>
        <Text variant="bodyXs" tone="secondary">
          {now >= end ? `ครบ ${minutes} นาทีแล้ว` : `เสร็จประมาณ ${clockOf(end)}`}
        </Text>
      </View>
    </View>
  );
}
