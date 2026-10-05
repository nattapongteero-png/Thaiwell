import React from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import { componentTokens } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

/**
 * LatticeLoader — ตัวบอกสถานะ "AI กำลังคิด"
 * พอร์ตจาก React Bits <LatticeLoader /> (เวอร์ชัน JS + CSS สำหรับเว็บ) มาเป็น React Native (Animated)
 * ใช้ได้ทั้ง iOS / Android / web — พฤติกรรมเหมือนต้นฉบับ:
 * - working: คลื่นไฟวิ่งตาม pattern + นาฬิกาจับเวลา
 * - done / error: คลื่นหยุดแล้วเปลี่ยนเป็นเครื่องหมายถูก / กากบาท พร้อมเวลาที่ใช้
 * ต่างจากต้นฉบับ: ไม่มี blur ตอนเปลี่ยนข้อความ (RN ไม่รองรับ filter) และความเร่งในแต่ละช่วง keyframe เป็นแบบเส้นตรง
 */

type PatternDef = { cells: (number | null)[]; loop: number; scale: number; lit?: number };

const PATTERNS: Record<string, Partial<Record<3 | 4, PatternDef>>> = {
  arrow: { 3: { cells: [1, 2, 3, 0, 1, 2, 1, 2, 3], loop: 7.2, scale: 1 } },
  dots: { 3: { cells: [0, 1, 2, 0, 1, 2, 0, 1, 2], loop: 3, scale: 2.4 } },
  ripple: { 3: { cells: [2, 1, 2, 1, 0, 1, 2, 1, 2], loop: 4.8, scale: 1.5 } },
  spiral: { 3: { cells: [0, 1, 2, 7, 8, 3, 6, 5, 4], loop: 9, scale: 1.2, lit: 0.35 } },
  orbit: {
    3: { cells: [0, 1, 2, 7, null, 3, 6, 5, 4], loop: 8, scale: 1.2 },
    4: { cells: [0, 1, 2, 3, 11, null, null, 4, 10, null, null, 5, 9, 8, 7, 6], loop: 6, scale: 1.2, lit: 0.45 },
  },
  snake: {
    3: { cells: [0, 1, 2, 5, 4, 3, 6, 7, 8], loop: 9, scale: 1, lit: 0.35 },
    4: { cells: [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12], loop: 16, scale: 1, lit: 0.25 },
  },
  sweep: { 4: { cells: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6], loop: 5, scale: 1, lit: 0.45 } },
  spin: { 4: { cells: [0, 0, 1, 1, 0, 0, 1, 1, 3, 3, 2, 2, 3, 3, 2, 2], loop: 4, scale: 1.6, lit: 0.35 } },
  rain: { 4: { cells: [0, 2, 1, 3, 1, 3, 2, 4, 2, 4, 3, 5, 3, 5, 4, 6], loop: 4, scale: 1.2, lit: 0.35 } },
  pulse: { 4: { cells: [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2], loop: 2.4, scale: 2.5, lit: 0.45 } },
};
const DEFAULT_PATTERN = { 3: 'orbit', 4: 'sweep' } as const;
const MARKS = {
  3: { done: [2, 3, 5, 7], error: [0, 2, 4, 6, 8] },
  4: { done: [7, 8, 10, 13], error: [0, 3, 5, 6, 9, 10, 12, 15] },
};
/** keyframes ของต้นฉบับ: [เริ่มสว่าง, สว่างถึง, กลับมืด] ตามสัดส่วน lit */
const KEYFRAMES: Record<string, [number, number, number]> = {
  '0.62': [0.18, 0.42, 0.62],
  '0.45': [0.13, 0.31, 0.45],
  '0.35': [0.1, 0.24, 0.35],
  '0.25': [0.07, 0.17, 0.25],
};

export type LatticePattern = string | { cells: (number | null)[]; loop?: number; scale?: number; lit?: number };

const resolvePattern = (pattern: LatticePattern, grid: 3 | 4): PatternDef => {
  if (typeof pattern === 'string') return PATTERNS[pattern]?.[grid] ?? (PATTERNS[DEFAULT_PATTERN[grid]][grid] as PatternDef);
  const cells = Array.from({ length: grid * grid }, (_, i) => pattern.cells[i] ?? null);
  const max = Math.max(0, ...cells.filter((v): v is number => v != null));
  return { cells, loop: pattern.loop ?? max + 4.2, scale: pattern.scale ?? 1, lit: pattern.lit ?? 0.62 };
};
const fmt = (ds: number) => (ds < 600 ? `${(ds / 10).toFixed(1)}s` : `${Math.floor(ds / 600)}m ${((ds % 600) / 10).toFixed(1)}s`);
const spoken = (ds: number) => (ds < 600 ? `${(ds / 10).toFixed(1)} วินาที` : `${Math.floor(ds / 600)} นาที ${((ds % 600) / 10).toFixed(1)} วินาที`);

export interface LatticeLoaderProps {
  status?: 'working' | 'done' | 'error';
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  pattern?: LatticePattern;
  grid?: 3 | 4;
  shape?: 'square' | 'round';
  color?: string;
  doneColor?: string;
  errorColor?: string;
  cellSize?: number;
  gap?: number;
  fontSize?: number;
  step?: number;
  idleOpacity?: number;
  glow?: boolean;
  glowColor?: string;
  showTimer?: boolean;
  /** วินาทีที่ควบคุมจากภายนอก — ถ้าส่งมา นาฬิกาภายในจะไม่เดิน */
  elapsed?: number;
}

/** ช่องเดียวที่กระพริบตามคลื่น — Animated.loop ต่อช่อง เริ่มหลังหน่วงเวลาเท่า delay ของช่องนั้น */
function RunCell({ delay, cycle, lit, idle, running, style }: { delay: number; cycle: number; lit: number; idle: number; running: boolean; style: object }) {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!running) return;
    let loop: Animated.CompositeAnimation | null = null;
    const id = setTimeout(() => {
      v.setValue(0);
      loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: cycle, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
      loop.start();
    }, delay);
    return () => {
      clearTimeout(id);
      loop?.stop();
    };
  }, [running, delay, cycle, v]);
  const [a, b, c] = KEYFRAMES[String(lit)] ?? KEYFRAMES['0.62'];
  const opacity = v.interpolate({ inputRange: [0, a, b, c, 1], outputRange: [idle, 1, 1, idle, idle] });
  return <Animated.View style={[style, { opacity }]} />;
}

export function LatticeLoader({
  status = 'working',
  label = 'กำลังคิด',
  doneLabel = 'คิดเสร็จใน',
  errorLabel = 'ล้มเหลวหลัง',
  pattern = 'orbit',
  grid = 3,
  shape = 'round',
  color,
  doneColor,
  errorColor,
  cellSize = componentTokens.lattice.cellSize,
  gap = componentTokens.lattice.gap,
  fontSize = componentTokens.lattice.fontSize,
  step = componentTokens.lattice.step,
  idleOpacity = componentTokens.lattice.idleOpacity,
  glow = false,
  glowColor = '',
  showTimer = true,
  elapsed,
}: LatticeLoaderProps) {
  const { colors } = useTheme();
  const ink = color ?? colors.ai.fg;
  const okColor = doneColor ?? colors.status.success.solid;
  const badColor = errorColor ?? colors.status.danger.solid;
  const n: 3 | 4 = grid === 4 ? 4 : 3;
  const [reduceMotion, setReduceMotion] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const pat = resolvePattern(pattern, n);
  const d = step * pat.scale;
  const cycle = reduceMotion ? 1400 : Math.round(pat.loop * d);
  const lit = pat.lit ?? 0.62;
  const markRef = React.useRef<'done' | 'error'>('done');
  const mark = status === 'working' ? markRef.current : status;
  markRef.current = mark;
  const markColor = mark === 'error' ? badColor : okColor;

  // นาฬิกาจับเวลา (หน่วย 0.1 วินาที)
  const [ds, setDs] = React.useState(0);
  React.useEffect(() => {
    if (elapsed != null) {
      setDs(Math.round(elapsed * 10));
      return;
    }
    if (status !== 'working') return;
    const startedAt = Date.now();
    setDs(0);
    const id = setInterval(() => setDs(Math.floor((Date.now() - startedAt) / 100)), 100);
    return () => clearInterval(id);
  }, [status, elapsed]);

  // สลับชั้นคลื่น ↔ เครื่องหมาย
  const markT = React.useRef(new Animated.Value(status === 'working' ? 0 : 1)).current;
  React.useEffect(() => {
    Animated.timing(markT, {
      toValue: status === 'working' ? 0 : 1,
      duration: status === 'working' ? 160 : 200,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [status, markT]);
  const runOpacity = markT.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const markScale = markT.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.9, 1] });

  const cellStyle = (bg: string) => ({
    width: cellSize,
    height: cellSize,
    borderRadius: shape === 'round' ? cellSize / 2 : Math.max(1, cellSize * 0.25),
    backgroundColor: bg,
  });
  const glowStyle = (c: string) =>
    glow ? { shadowColor: glowColor || c, shadowOpacity: 0.9, shadowRadius: cellSize * 1.2, shadowOffset: { width: 0, height: 0 } } : null;
  const side = n * cellSize + (n - 1) * gap;
  const layer = { position: 'absolute' as const, top: 0, left: 0, width: side, height: side, flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap };

  const verb = status === 'working' ? label : status === 'done' ? doneLabel : errorLabel;
  const announce = status === 'working' ? `${label} กำลังดำเนินการ` : `${verb}${showTimer ? ` ${spoken(ds)}` : ''}`;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={announce}
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: fontSize * 0.625 }}
    >
      <View style={{ width: side, height: side }}>
        {/* ชั้นคลื่น */}
        <Animated.View style={[layer, { opacity: runOpacity }]}>
          {pat.cells.map((unit, i) =>
            unit == null ? (
              <View key={i} style={[cellStyle(ink), { opacity: idleOpacity * 0.47 }]} />
            ) : (
              <RunCell
                key={i}
                delay={reduceMotion ? 0 : Math.round(unit * d)}
                cycle={cycle}
                lit={lit}
                idle={idleOpacity}
                running={status === 'working'}
                style={{ ...cellStyle(ink), ...glowStyle(ink) }}
              />
            ),
          )}
        </Animated.View>
        {/* ชั้นเครื่องหมาย ถูก / กากบาท */}
        <Animated.View style={[layer, { opacity: markT, transform: [{ scale: markScale }] }]}>
          {pat.cells.map((_, i) => {
            const on = MARKS[n][mark].includes(i);
            return <View key={i} style={[cellStyle(on ? markColor : ink), { opacity: on ? 1 : idleOpacity }, on ? glowStyle(markColor) : null]} />;
          })}
        </Animated.View>
      </View>
      <Text variant="labelMd" color={ink} style={{ fontSize, lineHeight: fontSize * 1.4 }}>
        {verb}
      </Text>
      {showTimer ? (
        <Text
          color={ink}
          style={{
            fontSize: fontSize * 0.875,
            lineHeight: fontSize * 1.3,
            opacity: 0.6,
            fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, monospace' }),
            fontVariant: ['tabular-nums'],
          }}
        >
          {fmt(ds)}
        </Text>
      ) : null}
    </View>
  );
}
