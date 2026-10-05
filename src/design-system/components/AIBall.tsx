import React from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/**
 * AIBall — ลูกแก้ว AI ของ ThaiWell (ตามปุ่ม AI ใน dock ของ ThaiWell back-office · ai2/ai3 v4)
 * ชั้น: ออร่าสีรุ้งหมุน+หายใจ → ลูกแก้วไล่สีเขียว-น้ำเงินเข้ม → กลุ่มแสงสีหมุนข้างใน 2 ชั้น (สวนทาง) → ไฮไลต์แก้ว → ดาว 3 ดวงกะพริบสลับ
 * CSS ต้นฉบับใช้ conic-gradient + blur → ที่นี่ใช้ radial gradient หลายดวงแทน (react-native-svg ไม่มี conic/blur ทุกแพลตฟอร์ม)
 */
const STAR = 'M12 1.5C12.6 7.4 16.6 11.4 22.5 12 16.6 12.6 12.6 16.6 12 22.5 11.4 16.6 7.4 12.6 1.5 12 7.4 11.4 11.4 7.4 12 1.5Z';
/** ตำแหน่ง/ขนาดดาวในกรอบ 28×28 (เท่าต้นฉบับ translate+scale) */
const STARS = [
  { x: 1, y: 6, k: 0.82, delay: 0, big: true },
  { x: 16, y: 1, k: 0.46, delay: 600, big: false },
  { x: 18.5, y: 17, k: 0.34, delay: 1300, big: false },
];

/** แสงเรืองรอบดาว: เว็บใช้ drop-shadow ตามรูปดาว (box-shadow จะเป็นกล่อง) · iOS เงาตามรูปทรงอยู่แล้ว */
const STAR_GLOW: object =
  Platform.OS === 'web'
    ? { filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 1px 1.5px rgba(10,60,45,0.45))' }
    : { shadowColor: '#FFFFFF', shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } };

function useLoop(duration: number, run: boolean, delay = 0, easing = Easing.linear) {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!run) return;
    const a = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v, duration, run, delay, easing]);
  return v;
}

/** วงแสงนุ่ม (สี → โปร่ง) ใช้แทน blur */
function Blob({ id, cx, cy, r, color, opacity = 1 }: { id: string; cx: number; cy: number; r: number; color: string; opacity?: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} r={r} fx={cx} fy={cy} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </>
  );
}

export function AIBall({ size = 64, stars = true, still: fixed = false }: { size?: number; /** true = ไม่เคลื่อนไหว (ใช้ซ้ำหลายจุด เช่น avatar ข้อความ AI) */ still?: boolean; /** false = ไม่มีดาว (มีไอคอนอื่นวางทับ เช่น ไมค์/ส่ง) */ stars?: boolean }) {
  const [still, setStill] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
  }, []);
  const run = !still && !fixed;
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');

  const auraSpin = useLoop(7000, run);
  const breathe = useLoop(3200, run, 0, Easing.inOut(Easing.sin));
  const swirlA = useLoop(5000, run);
  const swirlB = useLoop(9000, run);
  const tw = [useLoop(3000, run, STARS[0].delay, Easing.inOut(Easing.sin)), useLoop(3000, run, STARS[1].delay, Easing.inOut(Easing.sin)), useLoop(3000, run, STARS[2].delay, Easing.inOut(Easing.sin))];

  const spin = (v: Animated.Value, reverse = false) => v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'] });
  // ออร่าแคบ ๆ รอบลูกแก้ว (ต้นแบบ v4 ล่าสุด: inset -3px + mask วงกลม) · ทุกวงแสงจางหมดก่อนขอบพื้นที่วาด (ไม่งั้นขอบเหลี่ยม)
  const aura = Math.round(size * 1.3);
  const ao = (aura - size) / 2;
  const sw = size * 1.6;
  const starBox = size * 0.61;
  const u = starBox / 28;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      {/* ออร่ารุ้งรอบลูกแก้ว: หมุน 7 วิ + หายใจ 3.2 วิ */}
      <Animated.View
        style={[
          { position: 'absolute', width: aura, height: aura, left: -ao, top: -ao, opacity: 0.85 },
          { transform: [{ rotate: spin(auraSpin) }, { scale: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.96, 1.03, 0.96] }) }] },
        ]}
      >
        <Svg width={aura} height={aura}>
          {/* ศูนย์กลางห่างกลาง 0.12 + รัศมี 0.37 → ขอบวงไกลสุด 0.49 ของพื้นที่ (ไม่ชนขอบ) */}
          <Blob id={`${id}a1`} cx={aura * 0.5} cy={aura * 0.38} r={aura * 0.37} color="#2fd39a" />
          <Blob id={`${id}a2`} cx={aura * 0.62} cy={aura * 0.5} r={aura * 0.37} color="#3aa8ff" />
          <Blob id={`${id}a3`} cx={aura * 0.5} cy={aura * 0.62} r={aura * 0.37} color="#8b6bff" />
          <Blob id={`${id}a4`} cx={aura * 0.38} cy={aura * 0.5} r={aura * 0.37} color="#e45bd1" />
        </Svg>
      </Animated.View>

      {/* ลูกแก้ว */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.35)',
          shadowColor: '#2840A0',
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id={`${id}base`} cx={size * 0.35} cy={size * 0.15} r={size * 1.2} fx={size * 0.35} fy={size * 0.15} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#5ff0b8" />
              <Stop offset="0.38" stopColor="#14a37a" />
              <Stop offset="0.72" stopColor="#0b5e57" />
              <Stop offset="1" stopColor="#1d2a6b" />
            </RadialGradient>
            <LinearGradient id={`${id}inset`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.55" stopColor="#140A46" stopOpacity={0} />
              <Stop offset="1" stopColor="#140A46" stopOpacity={0.55} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}base)`} />
          <Blob id={`${id}p`} cx={size * 0.7} cy={size * 0.8} r={size * 0.46} color="#8b6bff" opacity={0.95} />
          <Blob id={`${id}b`} cx={size * 0.25} cy={size * 0.75} r={size * 0.42} color="#3aa8ff" opacity={0.9} />
        </Svg>
        {/* กลุ่มแสงหมุนข้างใน (สองชั้นสวนทาง) */}
        <Animated.View style={{ position: 'absolute', width: sw, height: sw, left: -size * 0.3, top: -size * 0.3, opacity: 0.6, transform: [{ rotate: spin(swirlA) }] }}>
          <Svg width={sw} height={sw}>
            <Blob id={`${id}s1`} cx={sw * 0.3} cy={sw * 0.35} r={sw * 0.27} color="#78FFD2" opacity={0.9} />
            <Blob id={`${id}s2`} cx={sw * 0.72} cy={sw * 0.68} r={sw * 0.24} color="#e45bd1" opacity={0.85} />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', width: sw, height: sw, left: -size * 0.3, top: -size * 0.3, opacity: 0.55, transform: [{ rotate: spin(swirlB, true) }] }}>
          <Svg width={sw} height={sw}>
            <Blob id={`${id}s3`} cx={sw * 0.66} cy={sw * 0.26} r={sw * 0.25} color="#3aa8ff" opacity={0.95} />
            <Blob id={`${id}s4`} cx={sw * 0.26} cy={sw * 0.76} r={sw * 0.21} color="#8b6bff" opacity={0.9} />
          </Svg>
        </Animated.View>
        {/* เงาด้านล่าง + ไฮไลต์แก้วด้านบน + จุดสะท้อน */}
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id={`${id}dot`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}shine`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.05} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id}inset)`} />
          <Ellipse cx={size * 0.49} cy={size * 0.23} rx={size * 0.29} ry={size * 0.17} fill={`url(#${id}shine)`} />
          {/* จุดสะท้อนเล็ก (.ai2__shine::after): right -14% · bottom -150% ของไฮไลต์ · 18%×30% ของไฮไลต์ → กลาง (0.81, 0.86) ขนาด ~0.104 · ขอบนุ่ม (blur 1px) */}
          <Ellipse cx={size * 0.809} cy={size * 0.859} rx={size * 0.052} ry={size * 0.051} fill={`url(#${id}dot)`} />
        </Svg>
      </View>

      {/* ดาว 3 ดวง: ดวงใหญ่ย่อ+หมุนเล็กน้อย · ดวงเล็กกะพริบสลับกัน */}
      {stars ? (
      <View style={{ position: 'absolute', width: starBox, height: starBox }}>
        {STARS.map((st, i) => {
          const w = 21 * st.k * u;
          const anim = st.big
            ? { transform: [{ scale: tw[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.88, 1] }) }, { rotate: tw[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '12deg', '0deg'] }) }] }
            : { opacity: tw[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.55, 1] }), transform: [{ scale: tw[i].interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.45, 1] }) }] };
          return (
            <Animated.View key={i} style={[{ position: 'absolute', left: (st.x + 1.5 * st.k) * u, top: (st.y + 1.5 * st.k) * u, width: w, height: w }, STAR_GLOW, anim]}>
              <Svg width={w} height={w} viewBox="1.5 1.5 21 21">
                <Path d={STAR} fill="#FFFFFF" />
              </Svg>
            </Animated.View>
          );
        })}
      </View>
      ) : null}
    </View>
  );
}
