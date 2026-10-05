import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * ชุดไอคอนของ dock ตามต้นแบบ ThaiWellAI (design-system/icons.tsx)
 * กริด 24px · เส้นมน 1.8 · รูปหลักเติมสีจาง (duotone) ตอนแท็บถูกเลือก (--icon-fill: rgba(21,128,61,0.16))
 * หน้าแรก/คิว = ไอคอนต้นฉบับ · สถานที่/ประวัติ/โปรไฟล์/ภาพรวม = วาดเพิ่มด้วยภาษาเดียวกัน (ต้นฉบับไม่มี)
 */
export type DockIconName = 'home' | 'places' | 'history' | 'profile' | 'queue' | 'insights' | 'stretch';
const ACTIVE_FILL = 'rgba(21,128,61,0.16)';

export function DockIcon({ name, color, size = 22, active }: { name: DockIconName; color: string; size?: number; active?: boolean }) {
  const tone = active ? ACTIVE_FILL : 'none';
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const t = { ...p, fill: tone };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' ? (
        <>
          <Path {...t} d="M3.8 10.4 12 4l8.2 6.4v8.3a2.3 2.3 0 0 1-2.3 2.3H6.1a2.3 2.3 0 0 1-2.3-2.3Z" />
          <Path {...p} d="M9.6 21v-4.6a2.4 2.4 0 0 1 4.8 0V21" />
        </>
      ) : name === 'places' ? (
        <>
          <Path {...t} d="M12 21s-6.8-5.6-6.8-11.2a6.8 6.8 0 0 1 13.6 0C18.8 15.4 12 21 12 21Z" />
          <Circle {...p} cx={12} cy={9.8} r={2.5} />
        </>
      ) : name === 'history' ? (
        <>
          <Circle {...t} cx={12} cy={12} r={8.5} />
          <Path {...p} d="M12 7.5V12l3 2" />
        </>
      ) : name === 'profile' ? (
        <>
          <Circle {...t} cx={12} cy={8.2} r={3.6} />
          <Path {...t} d="M5.6 19.6c.5-3.5 3.1-5.6 6.4-5.6s5.9 2.1 6.4 5.6a.9.9 0 0 1-.9 1H6.5a.9.9 0 0 1-.9-1Z" />
        </>
      ) : name === 'stretch' ? (
        // ดัมเบล (ออกกำลังกาย / ท่าบริหาร)
        <>
          <Rect {...t} x={2.6} y={9} width={3.4} height={6} rx={1.2} />
          <Rect {...t} x={18} y={9} width={3.4} height={6} rx={1.2} />
          <Rect {...t} x={5.6} y={6.6} width={3.2} height={10.8} rx={1.4} />
          <Rect {...t} x={15.2} y={6.6} width={3.2} height={10.8} rx={1.4} />
          <Path {...p} d="M8.8 12h6.4" />
        </>
      ) : name === 'queue' ? (
        <>
          <Rect {...t} x={4.5} y={4} width={15} height={17} rx={3.4} />
          <Path {...p} d="M9 3v2.4h6V3" />
          <Path {...p} d="M8.6 13.2l2.3 2.3 4.6-4.6" />
        </>
      ) : (
        <>
          <Rect {...t} x={3.5} y={3.5} width={17} height={17} rx={3.6} />
          <Path {...p} d="M8 16.5v-3M12 16.5V8M16 16.5v-5.5" />
        </>
      )}
    </Svg>
  );
}
