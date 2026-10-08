import React from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { LINE_ANIM, type LineNode } from './lineIconsAnimated';

/**
 * ไอคอน line-md แบบขยับ: เส้นวาดตัวเองตอนแสดงครั้งแรก (stroke-dashoffset จากต้นฉบับ → 0) · ค่าจาง/ทึบตามเวลาเดิมของ line-md
 * ใช้ Animated ของ react-native-svg (SMIL <animate> ใช้บนมือถือไม่ได้) · เล่นครั้งเดียวต่อการแสดง แล้วค้างที่ภาพสุดท้าย
 */
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

type Anim = NonNullable<LineNode['an']>[number];

function useAnims(list: Anim[] | undefined, play: boolean) {
  const vals = React.useRef((list ?? []).map((a) => new Animated.Value(play ? a.from : a.to))).current;
  React.useEffect(() => {
    if (!play || !list?.length) return;
    const runs = list.map((a, i) =>
      Animated.timing(vals[i], { toValue: a.to, delay: a.begin * 1000, duration: Math.max(1, a.dur * 1000), easing: Easing.linear, useNativeDriver: false }),
    );
    const all = Animated.parallel(runs);
    all.start();
    return () => all.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}

function Node({ n, play }: { n: LineNode; play: boolean }) {
  const vals = useAnims(n.an, play);
  const animated: Record<string, Animated.Value> = {};
  n.an?.forEach((a, i) => (animated[a.a] = vals[i]));
  const props = { ...n.p, ...animated } as Record<string, unknown>;
  // ค่าตั้งต้นของเส้นที่ยังไม่มี animation ของ dashoffset แต่มี dasharray (ต้นฉบับใช้ค่าเริ่มเป็นเส้นซ่อน) → แสดงครบ
  if (n.p.strokeDashoffset && !animated.strokeDashoffset) props.strokeDashoffset = 0;
  if (n.t === 'g')
    return (
      <G {...(props as object)}>
        {n.c?.map((ch, i) => (
          <Node key={i} n={ch} play={play} />
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

export function LineIcon({ name, size, color, play = true }: { name: string; size: number; color: string; play?: boolean }) {
  const icon = LINE_ANIM[name];
  if (!icon) return null;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${icon.w} ${icon.h}`} color={color}>
      {icon.c.map((n, i) => (
        <Node key={i} n={n} play={play} />
      ))}
    </Svg>
  );
}
