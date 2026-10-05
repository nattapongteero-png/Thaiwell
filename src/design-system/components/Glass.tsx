import React from 'react';
import { Animated, Easing, Platform, Pressable, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { componentTokens, fontFamily, radius, space, typeScale } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { AIBall } from './AIBall';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * AI CHAT COMPONENTS (แชท AI บนหน้าแรก)
 * vibe จาก reference: AI Receptionist (ลูกแก้ว AI, ช่องแชทลอย), Glucose (การ์ดแก้ว), Beauty Quiz (ปุ่มแคปซูลเข้ม), Bizee (ตัวเลขหนา)
 */

/** ไล่จางจากโปร่งใสเป็นสีพื้น — รองใต้ช่องแชทให้เนื้อหาที่เลื่อนผ่านไม่ทะลุ */
export function BottomFade({ height, width }: { height: number; width: number }) {
  const { colors } = useTheme();
  // ใช้ความกว้างเป็นตัวเลข (ไม่ใช่ "100%") — % ของ Svg คิดจากพื้นที่ใน padding ของแม่ ทำให้ขอบซ้าย/ขวาไม่ถูกคลุม
  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, bottom: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gradient.bottom} stopOpacity={0} />
          <Stop offset="0.12" stopColor={colors.gradient.bottom} stopOpacity={0.75} />
          <Stop offset="0.25" stopColor={colors.gradient.bottom} stopOpacity={0.97} />
          <Stop offset="1" stopColor={colors.gradient.bottom} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#bottomFade)" />
    </Svg>
  );
}

/**
 * TopFade — คู่กับ BottomFade: ทึบด้านบน (หลัง header) แล้วจางลงด้านล่าง
 * solidRatio = สัดส่วนความสูงที่ทึบเต็ม ก่อนเริ่มจาง
 */
export function TopFade({ height, solidRatio = 0.7 }: { height: number; solidRatio?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width="100%" height={height} style={{ position: 'absolute', left: 0, right: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gradient.bottom} stopOpacity={1} />
          <Stop offset={solidRatio} stopColor={colors.gradient.bottom} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.gradient.bottom} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height={height} fill="url(#topFade)" />
    </Svg>
  );
}

export function GlassCard({ children, style, onPress, strong }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; strong?: boolean }) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    borderRadius: radius.xl,
    padding: space[4],
    gap: space[3],
    backgroundColor: strong ? colors.glass.strong : colors.glass.bg,
    borderWidth: 1,
    borderColor: colors.glass.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    // Android: elevation บนพื้นโปร่งแสงจะเห็นแผ่นเงาเป็นสี่เหลี่ยมขาวทะลุขึ้นมากลางการ์ด → ไม่ใช้ (iOS/เว็บใช้ shadow* ด้านบน)
    elevation: 0,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}>
      {children}
    </Pressable>
  );
}

/** ลูกแก้ว AI — ตัวแทนผู้ช่วย */
export function AIOrb({ size = 'md', listening }: { size?: keyof typeof componentTokens.orb; listening?: boolean }) {
  const { colors } = useTheme();
  const d = componentTokens.orb[size];
  const id = `orb-${size}`;
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, shadowColor: colors.orb.to, shadowOpacity: listening ? 0.55 : 0.3, shadowRadius: d / 4, shadowOffset: { width: 0, height: d / 12 } }}>
      <Svg width={d} height={d}>
        <Defs>
          <RadialGradient id={`${id}-fill`} cx="0.35" cy="0.3" r="0.8">
            <Stop offset="0" stopColor={colors.orb.from} />
            <Stop offset="0.55" stopColor={colors.orb.to} />
            <Stop offset="1" stopColor={colors.orb.core} />
          </RadialGradient>
          <RadialGradient id={`${id}-hi`} cx="0.3" cy="0.25" r="0.35">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#${id}-fill)`} />
        <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#${id}-hi)`} />
        <Circle cx={d / 2} cy={d / 2} r={d / 2 - 1} fill="none" stroke="#FFFFFF" strokeOpacity={listening ? 0.9 : 0.45} strokeWidth={listening ? 2 : 1} />
      </Svg>
    </View>
  );
}

/** ขั้นของ Journey แบบจุด + เส้น — ผ่านแล้ว / ปัจจุบัน / ยังไม่ถึง */
export function StageProgress({ stages, current }: { stages: { key: string; label: string }[]; current: number }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel={`ขั้นที่ ${current + 1} จาก ${stages.length}: ${stages[current]?.label}`} style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {stages.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <React.Fragment key={s.key}>
              {i > 0 ? <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= current ? colors.brand.primary : colors.border.subtle }} /> : null}
              <View
                style={{
                  width: active ? 18 : 12,
                  height: active ? 18 : 12,
                  borderRadius: 9,
                  backgroundColor: done || active ? colors.brand.primary : colors.surface.default,
                  borderWidth: active ? 4 : 1.5,
                  borderColor: active ? colors.brand.subtle : done ? colors.brand.primary : colors.border.default,
                }}
              />
            </React.Fragment>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {stages.map((s, i) => (
          <Text key={s.key} variant="caption" tone={i === current ? 'primary' : 'tertiary'} style={i === current ? { fontFamily: typeScale.titleXs.fontFamily } : undefined}>
            {s.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** พื้นข้อความ AI แบบแก้วฝ้า — เหมือนการ์ดทั่วไปแต่โปร่ง เห็นหุ่นด้านหลัง (เว็บใช้ backdrop blur) */
const aiBubbleStyle = (): ViewStyle => {
  const t = componentTokens.aiBubble;
  return {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.xs,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: Platform.OS === 'web' ? t.bg : t.bgNoBlur,
    ...(Platform.OS === 'web' ? ({ backdropFilter: `blur(${t.blur}px) saturate(1.4)`, WebkitBackdropFilter: `blur(${t.blur}px) saturate(1.4)` } as object) : null),
  };
};

export function AIThreadMessage({ text, children, time, header }: { text?: string; children?: React.ReactNode; time?: string; header?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
      {/* avatar = ลูกแก้ว AI แบบเดียวกับปุ่ม AI (นิ่ง ไม่ให้ทุกข้อความเคลื่อนไหวพร้อมกัน) */}
      <AIBall size={componentTokens.orb.sm} still />
      <View style={{ flex: 1, gap: space[2], paddingTop: header ? space[2] : 0 }}>
        {header}
        {/* เฉพาะข้อความมีพื้น — การ์ด/ตัวเลือกด้านล่างมีพื้นของตัวเองอยู่แล้ว */}
        {text ? (
          <View style={aiBubbleStyle()}>
            <Text variant="bodyMd">{text}</Text>
          </View>
        ) : null}
        {children}
        {time ? (
          <Text variant="caption" tone="tertiary">
            {time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function UserBubble({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: colors.brand.primary, borderRadius: radius.xl, borderBottomRightRadius: radius.xs, paddingHorizontal: space[4], paddingVertical: space[2] }}>
      <Text variant="bodyMd" color={colors.brand.onPrimary}>
        {text}
      </Text>
    </View>
  );
}

export function DayDivider({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border.subtle }} />
    </View>
  );
}

/** ปุ่มตอบกลับด่วน / คำแนะนำในแชท */
/** ตัวเลือกตอบในแชท — รูปแบบเดียวทุกคำถาม · selected = ข้อที่เลือก (หลายข้อได้) */
export function ReplyChips({ options, onPick, selected }: { options: string[]; onPick?: (o: string) => void; selected?: string | string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((o) => {
        const sel = Array.isArray(selected) ? selected.includes(o) : o === selected;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onPick?.(o)}
            style={{
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: sel ? colors.brand.primary : colors.border.subtle,
              backgroundColor: sel ? colors.brand.primary : colors.glass.strong,
            }}
          >
            <Text variant="labelMd" color={sel ? colors.brand.onPrimary : colors.text.primary}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ช่องคุยกับ AI ติดล่าง — ลูกแก้ว AI ทางซ้าย (ไมค์ / ส่ง) + ช่องพิมพ์ */
export function ChatComposer({
  onSend,
  onVoice,
  placeholder = 'พิมพ์หรือพูดกับผู้ช่วย ThaiWell…',
  embedded,
}: {
  onSend: (text: string) => void;
  onVoice?: () => void;
  placeholder?: string;
  /** วางใน surface อื่น (เช่น dock) — ไม่มีกรอบและเงาของตัวเอง */
  embedded?: boolean;
}) {
  const { colors } = useTheme();
  const t = componentTokens.composerV2;
  const [text, setText] = React.useState('');
  const send = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  // สลับไอคอน ไมค์ ↔ ส่ง แบบมี animation (0 = ไมค์, 1 = ส่ง) + ลูกแก้วเด้งเล็กน้อย
  const hasText = text.trim().length > 0;
  const nativeDriver = Platform.OS !== 'web';
  const mode = React.useRef(new Animated.Value(0)).current;
  const pop = React.useRef(new Animated.Value(1)).current;
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true; // ไม่เด้งตอนเปิดหน้าครั้งแรก
      return;
    }
    Animated.parallel([
      Animated.timing(mode, { toValue: hasText ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 0.88, duration: 90, useNativeDriver: nativeDriver }),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 180, useNativeDriver: nativeDriver }),
      ]),
    ]).start();
  }, [hasText, mode, pop, nativeDriver]);
  const micOpacity = mode.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const micScale = mode.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });
  const micRotate = mode.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-90deg'] });
  const sendScale = mode.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const sendShift = mode.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <View
      style={[
        { height: t.height, flexDirection: 'row', alignItems: 'center', gap: t.gap },
        embedded
          ? { paddingHorizontal: 0 }
          : {
              borderRadius: t.radius,
              backgroundColor: colors.glass.strong,
              borderWidth: 1,
              borderColor: colors.border.subtle,
              paddingHorizontal: 6,
              shadowColor: '#0F172A',
              shadowOpacity: 0.1,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            },
      ]}
    >
      {/* ลูกแก้ว AI = ปุ่มเดียวทางซ้าย: ยังไม่พิมพ์ → ไมค์ (เปิดโหมดเสียง) · พิมพ์แล้ว → ส่ง · สลับไอคอนแบบมี animation */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasText ? 'ส่ง' : 'พูดกับผู้ช่วย'}
        onPress={hasText ? send : onVoice}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
          {/* ลูกแก้ว AI แบบเดียวกับปุ่ม AI (FAB) — ไม่มีดาว เพราะมีไอคอนไมค์/ส่งวางทับ */}
          <AIBall size={componentTokens.orb.md} stars={false} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: micOpacity, transform: [{ scale: micScale }, { rotate: micRotate }] }}>
            <Icon name="mic" size="md" color={colors.text.inverse} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity: mode, transform: [{ scale: sendScale }, { translateY: sendShift }] }}>
            <Icon name="arrow-up" size="md" color={colors.text.inverse} />
          </Animated.View>
        </Animated.View>
      </Pressable>
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        returnKeyType="send"
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        accessibilityLabel="ข้อความถึงผู้ช่วย AI"
        style={[typeScale.bodyMd, { flex: 1, color: colors.text.primary, paddingVertical: 0, paddingRight: space[3] }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
      />
    </View>
  );
}

/**
 * EdgeFade — เนื้อหาที่เลื่อนจางหายที่ขอบบน/ล่าง (ใต้ header / เหนือปุ่มด้านล่าง) แบบเดียวกับหน้าแรก
 * จางที่ตัวเนื้อหาเอง ไม่ใช่แผ่นทับ · เว็บ CSS mask · native MaskedView + แถบไล่ความทึบ (View ล้วน ไม่กระทบภาพ GL)
 */
export function EdgeFade({ top = 20, bottom = 28, horizontal, children }: { top?: number; bottom?: number; /** แนวนอน: top = ขอบซ้าย · bottom = ขอบขวา */ horizontal?: boolean; children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    const mask = `linear-gradient(to ${horizontal ? 'right' : 'bottom'}, transparent 0, black ${top}px, black calc(100% - ${bottom}px), transparent 100%)`;
    return <View style={[{ flex: 1 }, { maskImage: mask, WebkitMaskImage: mask } as object]}>{children}</View>;
  }
  const STEPS = 10;
  const ramp = (h: number, up: boolean) =>
    Array.from({ length: STEPS }, (_, i) => <View key={i} style={{ [horizontal ? 'width' : 'height']: h / STEPS, backgroundColor: '#000', opacity: up ? (i + 1) / STEPS : (STEPS - i) / STEPS }} />);
  return (
    <MaskedView
      style={{ flex: 1 }}
      maskElement={
        <View style={{ flex: 1, flexDirection: horizontal ? 'row' : 'column' }}>
          {ramp(top, true)}
          <View style={{ flex: 1, backgroundColor: '#000' }} />
          {ramp(bottom, false)}
        </View>
      }
    >
      {children}
    </MaskedView>
  );
}

/**
 * ScrollFadeMask — ทำให้ "ตัวเนื้อหา" จางหายที่ขอบบน (ไม่ใช่แผ่นทับ) จึงมองทะลุเห็นสิ่งที่อยู่ข้างหลัง เช่น หุ่น 3D
 * - โปร่งใสทั้งหมดตั้งแต่บนสุดถึง `clearUntil` แล้วค่อย ๆ ชัดขึ้นภายใน `ramp` px
 * - native ใช้ MaskedView · เว็บใช้ CSS mask-image
 */
export function ScrollFadeMask({ clearUntil, ramp = 24, children }: { clearUntil: number; ramp?: number; children: React.ReactNode }) {
  const [h, setH] = React.useState(0);
  if (Platform.OS === 'web') {
    const mask = `linear-gradient(to bottom, transparent ${clearUntil}px, black ${clearUntil + ramp}px)`;
    return <View style={[{ flex: 1 }, { maskImage: mask, WebkitMaskImage: mask } as object]}>{children}</View>;
  }
  if (Platform.OS === 'ios') {
    /* iOS: mask ที่วาดด้วย react-native-svg ทำให้ภาพ GL (หุ่น 3D ชั้นหลัง) หยุดอัปเดต
     * → ใช้ View ล้วนซ้อนเป็นแถบไล่ความทึบ (ช่วงจาง 12 ขั้น) แทน */
    const STEPS = 12;
    return (
      <MaskedView
        style={{ flex: 1 }}
        maskElement={
          <View style={{ flex: 1 }}>
            <View style={{ height: Math.max(0, clearUntil) }} />
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={{ height: ramp / STEPS, backgroundColor: '#000', opacity: (i + 1) / STEPS }} />
            ))}
            <View style={{ flex: 1, backgroundColor: '#000' }} />
          </View>
        }
      >
        {children}
      </MaskedView>
    );
  }
  const a = h ? clearUntil / h : 0;
  const b = h ? Math.min(1, (clearUntil + ramp) / h) : 0;
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <MaskedView
        style={{ flex: 1 }}
        maskElement={
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="scrollMask" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset={a} stopColor="#000" stopOpacity={0} />
                <Stop offset={b} stopColor="#000" stopOpacity={1} />
                <Stop offset="1" stopColor="#000" stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#scrollMask)" />
          </Svg>
        }
      >
        {children}
      </MaskedView>
    </View>
  );
}

/** ปุ่มแคปซูลไล่สีม่วง (ref: AI Receptionist "Call Now") — CTA หลักที่เกี่ยวกับผู้ช่วย AI */

export function GradientPill({
  label,
  icon,
  onPress,
  danger,
  accessibilityLabel,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  danger?: boolean;
  /** ปุ่มไอคอนอย่างเดียว (label ว่าง) ต้องบอกชื่อปุ่มให้ screen reader */
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const t = componentTokens.voice;
  const c = t.ctaGradient;
  const [w, setW] = React.useState(0);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = t.cta;
  // ปุ่มกลม (FAB) พื้นที่น้อย แสงฟุ้งแบบปุ่มยาวจะขาวเกิน → ลดความเข้มแสง
  const round = w > 0 && w <= h * 1.2;
  const glow = round ? 0.4 : 1;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        height: h,
        borderRadius: t.ctaRadius,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space[2],
        transform: [{ scale: pressed ? 0.98 : 1 }],
        // เงาม่วงจาง ๆ ใต้ปุ่ม (ไม่ฟุ้งเกิน)
        shadowColor: danger ? colors.status.danger.solid : c.shadow,
        // ปุ่มกลมลอย: เงาลึกขึ้นให้ดูลอยจากพื้น
        shadowOpacity: round ? 0.45 : 0.28,
        shadowRadius: round ? 16 : 12,
        shadowOffset: { width: 0, height: round ? 10 : 8 },
        elevation: round ? 10 : undefined,
      })}
    >
      {/* ref "Call Now": ไล่ม่วงนุ่ม ๆ + แสงลาเวนเดอร์ฟุ้งกว้าง ๆ ช่วงล่างกลางปุ่ม — น้อยชั้น ไม่มีจุดแข็ง */}
      {w > 0 ? (
        <Svg width={w} height={h} style={{ position: 'absolute' }}>
          <Defs>
            {/* พื้น: ม่วงเข้มทางซ้าย → ม่วงสว่างทางขวา */}
            <LinearGradient id={`${id}base`} x1="0" y1="0.3" x2="1" y2="0.7">
              <Stop offset="0" stopColor={danger ? colors.status.danger.solid : c.from} />
              <Stop offset="0.5" stopColor={danger ? colors.status.danger.solid : c.mid} />
              <Stop offset="1" stopColor={danger ? colors.status.danger.solid : c.to} />
            </LinearGradient>
            {/* แสงฟุ้ง: กว้าง จางยาว ไม่มีขอบชัด */}
            <RadialGradient id={`${id}glow`} cx="0.5" cy="0.5" rx="0.5" ry="0.5">
              <Stop offset="0" stopColor={c.glow} stopOpacity={0.85 * glow} />
              <Stop offset="0.35" stopColor={c.glow} stopOpacity={0.5 * glow} />
              <Stop offset="0.7" stopColor={c.glow} stopOpacity={0.15 * glow} />
              <Stop offset="1" stopColor={c.glow} stopOpacity={0} />
            </RadialGradient>
            {/* มิติของปุ่มกลม: ไฮไลต์บนซ้าย (แสงตกกระทบ) + เงาด้านล่าง (ทรงกลม) */}
            <RadialGradient id={`${id}hi`} cx="0.32" cy="0.22" rx="0.55" ry="0.45">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`${id}shade`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.45" stopColor="#1E0B5C" stopOpacity={0} />
              <Stop offset="1" stopColor="#1E0B5C" stopOpacity={0.32} />
            </LinearGradient>
            <ClipPath id={`${id}clip`}>
              <Rect x={0} y={0} width={w} height={h} rx={h / 2} />
            </ClipPath>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={`url(#${id}base)`} />
          {danger ? null : (
            <G clipPath={`url(#${id}clip)`}>
              <Ellipse cx={w * 0.52} cy={h * 0.95} rx={w * 0.5} ry={h * 0.95} fill={`url(#${id}glow)`} />
            </G>
          )}
          {round ? (
            <>
              <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={`url(#${id}shade)`} />
              <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={`url(#${id}hi)`} />
            </>
          ) : null}
        </Svg>
      ) : null}
      {icon ? <Icon name={icon} color={colors.text.inverse} /> : null}
      {/* ปุ่มไอคอนอย่างเดียว (label ว่าง) → ไม่มีช่องข้อความ ไอคอนอยู่กลางพอดี */}
      {label ? (
        <Text
          variant="labelLg"
          color={colors.text.inverse}
          style={{ fontFamily: fontFamily.semibold, textShadowColor: 'rgba(42,15,122,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
