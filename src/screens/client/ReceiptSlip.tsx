import React from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { Icon, Text, fontFamily, useTheme } from '../../design-system';
import { serviceMinutesOf } from '../../data/serviceMinutes';

/**
 * ใบเสร็จแบบสลิปกระดาษ — หน้าตาเดียวกับใบเสร็จของหลังบ้าน (ThaiWellAI · Receipt.tsx)
 * ช่องเครื่องพิมพ์ด้านบน → กระดาษไหลลงมา · ตรา "ชำระแล้ว" ประทับ · โลโก้ · ยอดเงินตัวใหญ่ · รอยฉีก · เส้นประ · ขอบล่างหยัก
 * กระดาษเป็นสีกระดาษเสมอ (ไม่เปลี่ยนตามโหมดมืด)
 */
const INK = '#2a2620';
const MUTED = '#8a8376';
const PAPER = '#fffdf7';
const LINE = '#d8cfbf';
const STAMP = '#2f8a52';

export type SlipLine = { name: string; amount: number };
export function ReceiptSlip({
  clinic,
  total,
  method,
  no,
  date,
  patient,
  hn,
  therapist,
  items,
}: {
  clinic: string;
  total: number;
  method: string;
  no: string;
  date: string;
  patient: string;
  hn?: string;
  therapist?: string;
  items: SlipLine[];
}) {
  const { colors } = useTheme();
  const bg = colors.surface.canvas;
  const [h, setH] = React.useState(0);
  // กระดาษไหลลงจากช่อง → ตราประทับ → บรรทัดค่อย ๆ ขึ้น
  const slide = React.useRef(new Animated.Value(0)).current;
  const stamp = React.useRef(new Animated.Value(0)).current;
  const lines = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!h) return;
    Animated.sequence([
      Animated.timing(slide, { toValue: 1, duration: 1100, easing: Easing.bezier(0.3, 0.9, 0.3, 1), useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(stamp, { toValue: 1, stiffness: 380, damping: 16, mass: 1, useNativeDriver: true }),
        Animated.timing(lines, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();
  }, [h, slide, stamp, lines]);
  const fmt = (n: number) => n.toLocaleString('th-TH');
  const fade = { opacity: lines.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) };
  const [svc, ...extras] = items;
  return (
    <View style={{ alignItems: 'center' }}>
      {/* ช่องเครื่องพิมพ์ */}
      <View style={{ width: '100%', height: 46, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: '#2f2b27', zIndex: 2, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ position: 'absolute', left: 18, top: 12, width: 7, height: 7, borderRadius: 4, backgroundColor: '#6ee08f' }} />
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 8, height: 6, borderRadius: 3, backgroundColor: '#0d0c0a' }} />
      </View>
      {/* กระดาษโผล่ออกจากใต้ช่อง */}
      <View style={{ width: '100%', paddingHorizontal: 14, marginTop: -14, overflow: 'hidden', paddingBottom: 18 }}>
        <Animated.View
          onLayout={(e) => setH(e.nativeEvent.layout.height)}
          style={{ transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-(h || 800), 0] }) }] }}
        >
          <View style={{ backgroundColor: PAPER, paddingTop: 30, paddingHorizontal: 24, paddingBottom: 18, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}>
            {/* ตราชำระแล้ว */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 168,
                right: 22,
                zIndex: 3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: 2,
                borderColor: STAMP,
                borderRadius: 8,
                backgroundColor: 'rgba(47,138,82,0.06)',
                opacity: stamp,
                transform: [{ rotate: '-12deg' }, { scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
              }}
            >
              <Icon name="check" size="xxs" color={STAMP} />
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 16, color: STAMP }}>ชำระแล้ว</Text>
            </Animated.View>

            {/* หัว: โลโก้ · คลินิก · ชนิดเอกสาร */}
            <Animated.View style={[{ alignItems: 'center', gap: 2 }, fade]}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#2f5f3f', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                <Svg width={30} height={30} viewBox="0 0 64 64" fill="none" stroke="#f3dcae" strokeWidth={2.2} strokeLinejoin="round">
                  <Path d="M32 50 C22 40 22 22 32 10 C42 22 42 40 32 50 Z" />
                  <Path d="M32 50 C18 46 10 34 12 20 C24 24 32 36 32 50 Z" />
                  <Path d="M32 50 C46 46 54 34 52 20 C40 24 32 36 32 50 Z" />
                  <Path d="M14 56 H50" strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: INK, textAlign: 'center' }}>{clinic}</Text>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, color: MUTED }}>ใบเสร็จรับเงิน · RECEIPT</Text>
            </Animated.View>

            {/* ยอดชำระ */}
            <Animated.View style={[{ alignItems: 'center', gap: 4, marginTop: 18, marginBottom: 6 }, fade]}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14, color: MUTED }}>ยอดชำระ</Text>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 38, lineHeight: 50, color: INK, fontVariant: ['tabular-nums'] }}>
                {fmt(total)}
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: MUTED }}> บาท</Text>
              </Text>
              <View style={{ marginTop: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f1ece2' }}>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 15, color: '#5a5348' }}>{method}</Text>
              </View>
            </Animated.View>

            <Tear bg={bg} />

            {/* ข้อมูลใบเสร็จ */}
            <Animated.View style={[{ gap: 5 }, fade]}>
              <Meta k="เลขที่" v={no} />
              <Meta k="วันที่" v={date} />
              <Meta k="ผู้ป่วย" v={patient} sub={hn} />
              {therapist ? <Meta k="ผู้บำบัด" v={therapist} /> : null}
            </Animated.View>

            <Dash />

            {/* รายการ: ค่าบริการ + หัตถการเพิ่ม */}
            <Animated.View style={[{ gap: 8 }, fade]}>
              {svc ? <Item name={svc.name} sub={`${serviceMinutesOf(svc.name)} นาที × 1`} amount={fmt(svc.amount)} /> : null}
              {extras.map((l, i) => (
                <Item key={`${l.name}${i}`} name={l.name} sub="หัตถการเพิ่ม" amount={fmt(l.amount)} />
              ))}
            </Animated.View>

            <Dash />

            <Animated.View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, fade]}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 14, lineHeight: 20, color: INK }}>รวมทั้งสิ้น</Text>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 18, lineHeight: 24, color: INK, fontVariant: ['tabular-nums'] }}>{fmt(total)} ฿</Text>
            </Animated.View>

            <Tear bg={bg} />

            <Animated.View style={[{ alignItems: 'center', gap: 2 }, fade]}>
              <Text style={{ fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18, color: INK }}>ขอบคุณที่ใช้บริการ</Text>
              <Text style={{ fontSize: 11, lineHeight: 15, color: MUTED }}>{clinic}</Text>
            </Animated.View>
          </View>
          {/* ขอบล่างหยัก */}
          <Svg width="100%" height={10} viewBox="0 0 160 10" preserveAspectRatio="none">
            <Polygon points={Array.from({ length: 11 }, (_, i) => `${i * 16},0 ${i * 16 + 8},10`).join(' ') + ' 160,0'} fill={PAPER} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

function Meta({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontSize: 12, lineHeight: 18, color: MUTED }}>{k}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 18, color: INK, textAlign: 'right' }}>{v}</Text>
        {sub ? <Text style={{ fontSize: 12, lineHeight: 18, color: MUTED }}>{sub}</Text> : null}
      </View>
    </View>
  );
}
function Item({ name, sub, amount }: { name: string; sub: string; amount: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ fontSize: 12, lineHeight: 18, color: INK }}>{name}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: MUTED }}>{sub}</Text>
      </View>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 18, color: INK, fontVariant: ['tabular-nums'] }}>{amount}</Text>
    </View>
  );
}
function Dash() {
  return <View style={{ height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: LINE, marginVertical: 12 }} />;
}
/** รอยฉีก: เส้นจุด + รอยเจาะครึ่งวงกลมที่ขอบทั้งสองข้าง (สีพื้นหลังจอ) */
function Tear({ bg }: { bg: string }) {
  return (
    <View style={{ height: 20, marginVertical: 10, marginHorizontal: -24, justifyContent: 'center' }}>
      <View style={{ marginHorizontal: 18, height: 0, borderTopWidth: 2, borderStyle: 'dotted', borderColor: LINE }} />
      <View style={{ position: 'absolute', left: -10, top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: bg }} />
      <View style={{ position: 'absolute', right: -10, top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: bg }} />
    </View>
  );
}
