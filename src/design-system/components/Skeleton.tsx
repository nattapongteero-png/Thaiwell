import React from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, type ImageProps, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Skeleton loading — แสดงเฉพาะเมื่อรอนานเกิน 300ms (โหลดเร็ว = ไม่กะพริบ) · แสงวิ่งผ่านจากซ้ายไปขวา
 * - Shimmer: พื้นที่ว่างรอเนื้อหา (ใส่ children = รูปทรงที่จะเห็นแทน เช่น เงาหุ่น)
 * - LoadingImage: รูป/GIF ที่ค่อย ๆ จางเข้าเมื่อโหลดเสร็จ มี Shimmer รองระหว่างรอ
 * - BodySilhouette: เงาโครงร่างคน (ระหว่างรอหุ่น 3D)
 */
const DELAY = 300;

/** true เมื่อรอนานเกิน DELAY และยังไม่เสร็จ */
function useDelayed(waiting: boolean) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!waiting) return setShow(false);
    const id = setTimeout(() => setShow(true), DELAY);
    return () => clearTimeout(id);
  }, [waiting]);
  return show;
}

export function Shimmer({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const { colors } = useTheme();
  const [w, setW] = React.useState(0);
  const x = React.useRef(new Animated.Value(0)).current;
  const [still, setStill] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  React.useEffect(() => {
    if (still) return;
    const a = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }));
    a.start();
    return () => a.stop();
  }, [x, still]);
  const band = Math.max(80, w * 0.6);
  return (
    <View
      accessibilityLabel="กำลังโหลด"
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[{ overflow: 'hidden', backgroundColor: colors.surface.sunken }, style]}
    >
      {children}
      {w > 0 && !still ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, width: band, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-band, w] }) }] }}
        >
          <Svg width={band} height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.6} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shimmer)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** เงาโครงร่างคนยืน (สัดส่วนหุ่น) — ใช้ระหว่างรอภาพท่ายืด/หุ่น 3D */
export function BodySilhouette({ height, color }: { height: number; color?: string }) {
  const { colors } = useTheme();
  const w = height * 0.42;
  return (
    <Svg width={w} height={height} viewBox="0 0 42 100">
      <Path
        fill={color ?? colors.border.default}
        d="M21 2a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm-9 17h18c3 0 5 2 5.4 5l3.4 20a2.6 2.6 0 0 1-5.1 1L31 32v18l-1 46a3.2 3.2 0 0 1-6.4.2L22 60h-2l-1.6 36.2a3.2 3.2 0 0 1-6.4-.2L11 50V32l-2.7 13a2.6 2.6 0 0 1-5.1-1l3.4-20C7 21 9 19 12 19Z"
      />
    </Svg>
  );
}

/** รูป/GIF: Shimmer + เงาหุ่นระหว่างรอ (เกิน 300ms) → จางเข้าเมื่อโหลดเสร็จ */
export function LoadingImage({ style, silhouette, ...img }: ImageProps & { silhouette?: number }) {
  const [loaded, setLoaded] = React.useState(false);
  const show = useDelayed(!loaded);
  const fade = React.useRef(new Animated.Value(0)).current;
  return (
    <View style={[{ overflow: 'hidden' }, style as StyleProp<ViewStyle>]}>
      {show ? (
        <Shimmer style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{silhouette ? <BodySilhouette height={silhouette} /> : null}</Shimmer>
      ) : null}
      <Animated.Image
        {...img}
        onLoad={(e) => {
          setLoaded(true);
          Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
          img.onLoad?.(e);
        }}
        style={{ width: '100%', height: '100%', opacity: fade }}
      />
    </View>
  );
}

export { useDelayed as useDelayedLoading };

/* ------------------------------------------------------------------ โหลดข้อมูลของหน้า
 * ต้นแบบยังใช้ข้อมูลในเครื่อง → จำลองเวลาโหลดจาก API (MOCK_LATENCY) ครั้งแรกที่เปิดหน้านั้น
 * เปิดซ้ำ = มีข้อมูลในแคชแล้ว ขึ้นทันที (แบบ SWR / React Query)
 * ต่อ API จริง: เปลี่ยน useScreenData ให้คืน isLoading ของ query แทน (โครง skeleton ใช้ต่อได้เลย)
 */
export const MOCK_LATENCY = 700;
const loadedKeys = new Set<string>();

export function useScreenData(key: string) {
  // key เปลี่ยน (เช่น เปลี่ยนแท็บเรื่องบนหน้าแรก) → เรื่องที่ยังไม่เคยโหลดได้ skeleton ด้วย (เดิมคำนวณครั้งเดียวตอนเปิดหน้า)
  const [, setDone] = React.useState(0);
  const loading = !loadedKeys.has(key);
  React.useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => {
      loadedKeys.add(key);
      setDone((n) => n + 1);
    }, MOCK_LATENCY);
    return () => clearTimeout(id);
  }, [key, loading]);
  return loading;
}

/** แท่ง skeleton (ข้อความ / ปุ่ม / ภาพ) */
export function Bone({ w = '100%', h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  return <Shimmer style={[{ width: w, height: h, borderRadius: r }, style]} />;
}

function SkCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ padding: 16, gap: 10, borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }, style]}>{children}</View>;
}

/** โครงหน้าระหว่างโหลด: grid = การ์ดภาพ 2 คอลัมน์ · list = รายการ · detail = ภาพใหญ่ + เนื้อหา */
export function ScreenSkeleton({ variant, count = 4 }: { variant: 'grid' | 'list' | 'detail'; count?: number }) {
  if (variant === 'grid')
    return (
      <View accessibilityLabel="กำลังโหลด" style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[64, 88, 88, 72].map((w, i) => (
            <Bone key={i} w={w} h={36} r={18} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {Array.from({ length: count }, (_, i) => (
            <SkCard key={i} style={{ width: '47.8%', padding: 0, gap: 0, overflow: 'hidden' }}>
              <Shimmer style={{ height: 150, alignItems: 'center', justifyContent: 'center' }}>
                <BodySilhouette height={84} />
              </Shimmer>
              <View style={{ padding: 12, gap: 8 }}>
                <Bone w="70%" h={16} />
                <Bone w="50%" h={12} />
              </View>
            </SkCard>
          ))}
        </View>
      </View>
    );
  if (variant === 'detail')
    return (
      <View accessibilityLabel="กำลังโหลด" style={{ gap: 12 }}>
        <SkCard style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <Shimmer style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
            <BodySilhouette height={150} />
          </Shimmer>
          <View style={{ padding: 16, gap: 10 }}>
            <Bone w="55%" h={20} />
            <Bone w="40%" h={12} />
            {[90, 80, 85].map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Bone w={24} h={24} r={12} />
                <Bone w={`${w - 15}%`} h={14} />
              </View>
            ))}
            <Bone h={48} r={24} style={{ marginTop: 6 }} />
          </View>
        </SkCard>
        <SkCard>
          <Bone w="40%" h={16} />
          <Bone w="70%" h={12} />
          <Bone w="60%" h={12} />
        </SkCard>
      </View>
    );
  return (
    <View accessibilityLabel="กำลังโหลด" style={{ gap: 12 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkCard key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bone w={44} h={44} r={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bone w="60%" h={16} />
            <Bone w="85%" h={12} />
          </View>
        </SkCard>
      ))}
    </View>
  );
}
