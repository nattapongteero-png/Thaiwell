import React from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import { radius as R, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * JellyRadio — พอร์ตจาก React Bits "Jelly Radio" (motion/react) มาเป็น React Native Animated
 * ชิปที่เลือก "พอง" ขึ้น (กว้างก่อนสูง = เยลลี่) · ชิปข้าง ๆ ถูกดันหลบและหดลงเล็กน้อย ทยอยขยับตามระยะห่าง (stagger)
 * ค่าพารามิเตอร์ความหมายเดียวกับต้นฉบับ: swell / barge / shrink / jelly / bounce / stagger / stiffness
 */
export interface JellyRadioProps {
  items: string[];
  /** index ที่เลือก (controlled) · -1 = ยังไม่เลือก (เช่น เลือกอยู่ในอีกกลุ่ม) */
  value: number;
  /** ชิปที่ไม่ได้เลือกใช้ขอบเส้นประ (เช่น ของที่ยังไม่ยืนยัน) */
  dashed?: boolean;
  onChange: (index: number) => void;
  size?: 'sm' | 'md' | 'lg';
  gap?: number;
  /** ชิปที่เลือกขยายเท่าไหร่ (0.2 = 20%) — กำหนดระยะที่ชิปข้าง ๆ ต้องหลบด้วย */
  swell?: number;
  /** px ที่ดันชิปข้าง ๆ เพิ่มจากระยะหลบ */
  barge?: number;
  /** ชิปที่ไม่ได้เลือกหดลงเท่าไหร่ */
  shrink?: number;
  /** สัดส่วน "กว้างก่อนสูง" 0 = พองเท่ากัน · 1.5 = เยลลี่มาก */
  jelly?: number;
  /** 1 − damping ratio · 0 = หยุดนิ่ง · 0.4 = เด้ง */
  bounce?: number;
  /** ms ต่อระยะห่าง 1 ชิป ก่อนชิปข้าง ๆ เริ่มขยับ */
  stagger?: number;
  stiffness?: number;
  accessibilityLabel?: string;
}

const SIZES = { sm: { h: 28, font: 'labelSm' as const, px: 12 }, md: { h: 36, font: 'labelMd' as const, px: 16 }, lg: { h: 44, font: 'labelLg' as const, px: 20 } };

/** ชดเชยตำแหน่งตัวอักษรไทยในบรรทัด (iOS วางสูง · เว็บวางต่ำเล็กน้อย) */
const LABEL_NUDGE = Platform.select({ ios: 1, android: 0.5, default: -0.5 }) ?? 0;

type MV = { x: Animated.Value; sx: Animated.Value; sy: Animated.Value };

/** spring แบบเดียวกับต้นฉบับ: damping = 2√(k·m)·(1 − bounce) */
const spring = (v: Animated.Value, to: number, k: number, m: number, bounce: number, delay: number) =>
  Animated.sequence([
    Animated.delay(delay),
    Animated.spring(v, { toValue: to, stiffness: k, damping: 2 * Math.sqrt(k * m) * (1 - bounce), mass: m, useNativeDriver: true }),
  ]);

export function JellyRadio({
  items,
  value,
  onChange,
  size = 'md',
  gap = space[2],
  swell = 0.2,
  barge = 6,
  shrink = 0.05,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
  accessibilityLabel = 'ตัวเลือก',
  dashed,
}: JellyRadioProps) {
  const { colors } = useTheme();
  const s = SIZES[size];
  const mvs = React.useRef<MV[]>([]);
  const widths = React.useRef<number[]>([]);
  const applied = React.useRef(value);
  const running = React.useRef<Animated.CompositeAnimation | null>(null);
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduce).catch(() => {});
  }, []);

  const mvFor = (i: number) => {
    if (!mvs.current[i]) mvs.current[i] = { x: new Animated.Value(0), sx: new Animated.Value(1), sy: new Animated.Value(1) };
    return mvs.current[i];
  };

  const apply = (sel: number, instant: boolean) => {
    const push = ((widths.current[sel] ?? 0) * swell) / 2 + barge;
    const anims: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < items.length; i++) {
      const mv = mvFor(i);
      const on = i === sel;
      const far = Math.abs(i - sel);
      // ไม่มีตัวเลือก → ทุกชิปขนาดปกติ อยู่ที่เดิม
      const x = sel < 0 ? 0 : Math.sign(i - sel) * push;
      const sc = sel < 0 ? 1 : on ? 1 + swell : 1 - shrink;
      if (instant || reduce) {
        mv.x.setValue(x);
        mv.sx.setValue(sc);
        mv.sy.setValue(sc);
        continue;
      }
      const k = stiffness * (1 - 0.12 * Math.min(far, 3));
      const delay = running.current ? 0 : far * stagger;
      anims.push(spring(mv.x, x, k, 0.9, bounce, delay));
      // เยลลี่: แนวนอนเร็ว/เด้งกว่า · แนวตั้งตามมาช้ากว่าเล็กน้อย
      anims.push(spring(mv.sx, sc, k * (1 + 0.24 * jelly), 0.9 - 0.1 * jelly, Math.min(0.85, bounce + 0.3 * jelly), delay));
      anims.push(spring(mv.sy, sc, k * (1 - 0.14 * jelly), 0.9 + 0.05 * jelly, bounce, delay + 50 * jelly));
    }
    if (anims.length) {
      running.current?.stop();
      const a = Animated.parallel(anims);
      running.current = a;
      a.start(() => {
        if (running.current === a) running.current = null;
      });
    }
  };

  // ค่าที่เปลี่ยนจากภายนอก (ไม่ได้มาจากการแตะ) → กระโดดไปเลย
  React.useEffect(() => {
    if (applied.current === value) return;
    const from = applied.current;
    applied.current = value;
    // เลือกจากอีกกลุ่ม/ยกเลิก → เด้งกลับขนาดปกติแบบนุ่ม
    apply(value, from >= 0 && value >= 0 ? true : false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onLayoutChip = (i: number) => (e: LayoutChangeEvent) => {
    widths.current[i] = e.nativeEvent.layout.width;
    if (widths.current.filter((w) => w > 0).length === items.length) apply(applied.current, true);
  };

  const commit = (i: number) => {
    if (i === applied.current) return;
    applied.current = i;
    apply(i, false);
    onChange(i);
  };

  // เผื่อพื้นที่รอบกลุ่มให้ชิปพองได้โดยไม่ถูกตัด
  const padY = Math.ceil((s.h * swell) / 2) + 2;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap, paddingVertical: padY, paddingHorizontal: Math.ceil(barge) + 2, marginHorizontal: -(Math.ceil(barge) + 2), marginVertical: -padY }}
    >
      {items.map((label, i) => {
        const mv = mvFor(i);
        const on = i === value;
        return (
          <Animated.View key={label} onLayout={onLayoutChip(i)} style={{ transform: [{ translateX: mv.x }, { scaleX: mv.sx }, { scaleY: mv.sy }] }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={label}
              onPress={() => commit(i)}
              style={({ pressed }) => ({
                height: s.h,
                paddingHorizontal: s.px,
                borderRadius: R.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? colors.text.primary : colors.surface.default,
                borderWidth: 1,
                borderStyle: dashed && !on ? 'dashed' : 'solid',
                borderColor: on ? colors.text.primary : dashed ? colors.border.strong : colors.border.subtle,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {/* ฟอนต์ไทยเผื่อที่ด้านบนมาก → ใช้ lineHeight เท่าความสูงชิป + ขยับตามแพลตฟอร์ม ให้ตัวอักษรอยู่กึ่งกลางพอดี */}
              <Text
                variant={s.font}
                color={on ? colors.text.inverse : colors.text.primary}
                style={{ lineHeight: s.h - 2, includeFontPadding: false, textAlignVertical: 'center', transform: [{ translateY: LABEL_NUDGE }] }}
              >
                {label}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
