import React from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { LINE_ANIM, type LineNode } from './lineIconsAnimated';

/**
 * ไอคอน line-md แบบขยับ: เส้นวาดตัวเอง (stroke-dashoffset จากต้นฉบับ → 0) · ค่าจาง/ทึบ/ขนาดวงตามเวลาเดิมของ line-md
 * ใช้ Animated ของ react-native-svg (SMIL <animate> ใช้บนมือถือไม่ได้)
 * ปกติแสดงภาพสุดท้ายนิ่ง ๆ · run เปลี่ยน (เช่น กดเลือกแท็บ) → เล่น 1 รอบแล้วค้างที่ภาพสุดท้าย
 */
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

type Anim = NonNullable<LineNode['an']>[number];

function useAnims(list: Anim[] | undefined, run: number) {
  // เล่นตั้งแต่แสดงครั้งแรก (run > 0 ตอนสร้าง) → เริ่มที่ค่าต้น ไม่กะพริบภาพสุดท้ายก่อน
  const vals = React.useRef((list ?? []).map((a) => new Animated.Value(run ? a.from : a.to))).current;
  React.useEffect(() => {
    if (!run || !list?.length) return;
    list.forEach((a, i) => vals[i].setValue(a.from));
    const all = Animated.parallel(
      list.map((a, i) => Animated.timing(vals[i], { toValue: a.to, delay: a.begin * 1000, duration: Math.max(1, a.dur * 1000), easing: Easing.linear, useNativeDriver: false })),
    );
    all.start();
    return () => all.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  return vals;
}

function Node({ n, run }: { n: LineNode; run: number }) {
  const vals = useAnims(n.an, run);
  const animated: Record<string, Animated.Value> = {};
  n.an?.forEach((a, i) => (animated[a.a] = vals[i]));
  const props = { ...n.p, ...animated } as Record<string, unknown>;
  // ค่าตั้งต้นของเส้นที่ยังไม่มี animation ของ dashoffset แต่มี dasharray (ต้นฉบับใช้ค่าเริ่มเป็นเส้นซ่อน) → แสดงครบ
  if (n.p.strokeDashoffset && !animated.strokeDashoffset) props.strokeDashoffset = 0;
  if (n.t === 'g')
    return (
      <G {...(props as object)}>
        {n.c?.map((ch, i) => (
          <Node key={i} n={ch} run={run} />
        ))}
      </G>
    );
  if (n.t === 'circle') return <ACircle {...(props as object)} />;
  if (n.t === 'path') return <APath {...(props as object)} />;
  return null;
}

export function hasLineAnim(name: string) {
  return !!LINE_ANIM[name];
}

export function LineIcon({ name, size, color, run = 0 }: { name: string; size: number; color: string; /** เปลี่ยนค่า (> 0) = เล่น animation 1 รอบ */ run?: number }) {
  const icon = LINE_ANIM[name];
  if (!icon) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${icon.w} ${icon.h}`} color={color}>
      {icon.c.map((n, i) => (
        <Node key={i} n={n} run={run} />
      ))}
    </Svg>
  );
}

/**
 * ไอคอนผลสำเร็จ/สถานะที่เพิ่งเกิดขึ้น (จองแล้ว · เช็กอินแล้ว · ส่งผลประเมินแล้ว) — วาดเส้น 1 รอบตอนแสดง แล้วค้างภาพสุดท้าย
 * ไม่มีแบบขยับ → ไม่แสดงอะไร (ใช้คู่กับไอคอนปกติเป็นค่าสำรองได้)
 */
export function PlayOnceIcon({ name, size, color }: { name: string; size: number; color: string }) {
  if (!LINE_ANIM[name]) return null;
  return <LineIcon name={name} size={size} color={color} run={1} />;
}
