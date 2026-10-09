import React from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Text, radius, space, useTheme } from '../../../design-system';
import { elevation } from '../../../design-system/tokens';
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
/** หัววิ่งของแถบ (ภาพการนวด) */
const HEAD = 36;
const BAR = 6;
/** แสงวิ่ง: กว้าง · เวลาวิ่งหนึ่งรอบ · พักก่อนรอบถัดไป */
const GLINT = 56;
const GLINT_MS = 1400;
const GLINT_REST = 500;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HEAD_IMG = require('../../../../assets/progress_head.png');
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
  const [w, setW] = React.useState(0);
  const headX = frac * (w - HEAD);
  const fillW = Math.max(0, headX + HEAD / 2);
  const running = now < end;
  return (
    <View style={{ gap: space[1] }}>
      {/* แถบความคืบหน้า + หัววิ่ง (ภาพการนวด) เคลื่อนตามเวลาที่ผ่านไป
       * กำลังนวด: แสงวิ่งบนเส้น (จากเริ่ม → หัววิ่ง) + วงแสงรอบหัววิ่งเต้นเบา ๆ = กำลังไปถึงเป้าหมาย · ครบเวลาแล้วหยุด */}
      <View style={{ height: HEAD, justifyContent: 'center' }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <View style={{ height: BAR, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
          {w ? <ProgressFill width={fillW} color={colors.brand.primary} running={running} /> : null}
        </View>
        {w ? (
          <View style={{ position: 'absolute', left: headX, width: HEAD, height: HEAD }}>
            {running ? <HeadGlow color={colors.brand.primary} /> : null}
            <View style={{ width: HEAD, height: HEAD, borderRadius: HEAD / 2, borderWidth: 2, borderColor: colors.surface.default, backgroundColor: colors.surface.default, ...elevation[1] }}>
              <Image source={HEAD_IMG} style={{ width: HEAD - 4, height: HEAD - 4, borderRadius: (HEAD - 4) / 2 }} />
            </View>
          </View>
        ) : null}
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

/** เส้นที่ผ่านไปแล้ว: ไล่สีอ่อน → เข้มที่หัววิ่ง + แสงวิ่งซ้ำ ๆ จากต้นเส้นไปหาหัววิ่ง */
function ProgressFill({ width, color, running }: { width: number; color: string; running: boolean }) {
  const x = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!running || width < GLINT) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: GLINT_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(GLINT_REST),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [running, width >= GLINT, x]);
  return (
    <View style={{ width, height: BAR, borderRadius: radius.full, overflow: 'hidden' }}>
      <Svg width={width} height={BAR}>
        <Defs>
          <LinearGradient id="pf" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0.45} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={BAR} fill="url(#pf)" />
      </Svg>
      {running && width >= GLINT ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: GLINT, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-GLINT, width] }) }] }}>
          <Svg width={GLINT} height={BAR}>
            <Defs>
              <LinearGradient id="glint" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.75} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={GLINT} height={BAR} fill="url(#glint)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** วงแสงรอบหัววิ่ง — ขยายแล้วจางหาย จังหวะเดียวกับแสงวิ่ง (แสงวิ่งถึงหัว = วงแสงเต้น) */
function HeadGlow({ color }: { color: string }) {
  const t = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(GLINT_MS * 0.8),
        Animated.timing(t, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(GLINT_REST + GLINT_MS * 0.2 - 700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: HEAD,
        height: HEAD,
        borderRadius: HEAD / 2,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
      }}
    />
  );
}
