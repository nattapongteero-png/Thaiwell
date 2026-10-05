import React from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AIOrb, GradientPill, Icon, IconButton, LatticeLoader, Text, componentTokens, fontFamily, radius, space, useGrid, useTheme, type IconName } from '../../design-system';
import { useNav } from '../../navigation/types';

/**
 * คุยกับผู้ช่วยด้วยเสียง — concept ตาม ref "AI Receptionist Setup & Test Call UI"
 * ลูกแก้ว AI ใหญ่ · ชื่อ + สถานะ · ปุ่มแคปซูลไล่สี · คำบรรยายสด · กลุ่มปุ่มกลมลอยด้านล่าง
 * ⚠️ ยังไม่เชื่อม AI/เสียงจริง — บทสนทนาเป็นตัวอย่างเพื่อแสดง flow
 */
type Phase = 'idle' | 'listening' | 'thinking' | 'done';

const SCRIPT: { from: 'ai' | 'user'; text: string }[] = [
  { from: 'ai', text: 'สวัสดีค่ะ วันนี้มีอาการตรงไหนบ้างคะ' },
  { from: 'user', text: 'ปวดตึงบ่าขวามาสามวัน นั่งคอมทั้งวันค่ะ' },
  { from: 'ai', text: 'ถ้าให้คะแนนความปวด 0 ถึง 10 ประมาณเท่าไหร่คะ' },
  { from: 'user', text: 'ประมาณหกค่ะ' },
  { from: 'ai', text: 'มีชาหรืออ่อนแรงแขน หรือมีไข้ไหมคะ' },
  { from: 'user', text: 'ไม่มีค่ะ' },
  { from: 'ai', text: 'ขอบคุณค่ะ สรุปอาการให้ในแชทแล้วนะคะ' },
];

const STATUS: Record<Phase, string> = {
  idle: 'ผู้ช่วยพร้อมคุยกับคุณแล้ว',
  listening: 'กำลังฟัง… พูดได้เลยค่ะ',
  thinking: 'กำลังวิเคราะห์และสรุปอาการ…',
  done: 'สรุปอาการเรียบร้อย',
};

export function AIVoiceScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const g = useGrid();
  const insets = useSafeAreaInsets();
  const t = componentTokens.voice;
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [step, setStep] = React.useState(0);

  // ลูกแก้วหายใจ (idle ช้า · listening เร็วและกว้างกว่า)
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: phase === 'listening' ? 700 : 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: phase === 'listening' ? 700 : 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);
  const amp = phase === 'listening' ? 0.08 : 0.03;
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amp] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.25 + amp] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [phase === 'listening' ? 0.45 : 0.2, 0] });

  // เดินบทสนทนาตัวอย่างระหว่างฟัง
  React.useEffect(() => {
    if (phase !== 'listening') return;
    if (step >= SCRIPT.length - 1) {
      const id = setTimeout(() => setPhase('thinking'), 1400);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setStep((s) => s + 1), 1600);
    return () => clearTimeout(id);
  }, [phase, step]);

  // AI กำลังคิด/สรุป → LatticeLoader · คิดเสร็จแล้วแสดงผลทันที (ไม่มีสถานะ "คิดเสร็จ")
  React.useEffect(() => {
    if (phase !== 'thinking') return;
    const id = setTimeout(() => setPhase('done'), 2200);
    return () => clearTimeout(id);
  }, [phase]);

  const start = () => {
    setStep(0);
    setPhase('listening');
  };
  const current = SCRIPT[step];
  const prev = step > 0 ? SCRIPT[step - 1] : undefined;
  const hero = componentTokens.orb.hero;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.default, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space[4]) }}>
      {/* แถบบน */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[2] }}>
        <IconButton icon="x" label="ปิด" onPress={() => nav.goBack()} />
        <Text variant="labelMd" tone="secondary">
          โหมดเสียง
        </Text>
        <IconButton icon="more-horizontal" label="ตัวเลือกเพิ่มเติม" />
      </View>

      <View style={{ flex: 1, width: '100%', maxWidth: g.maxContentWidth, alignSelf: 'center', paddingHorizontal: space[6], alignItems: 'center', justifyContent: 'center', gap: space[6] }}>
        {/* ลูกแก้ว AI + รัศมีเรืองแสง */}
        <View style={{ width: hero * 1.5, height: hero * 1.5, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: hero, height: hero, borderRadius: hero / 2, opacity: haloOpacity, transform: [{ scale: haloScale }] }}>
            <Svg width={hero} height={hero}>
              <Defs>
                <RadialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
                  <Stop offset="0.6" stopColor={colors.orb.to} stopOpacity={0.9} />
                  <Stop offset="1" stopColor={colors.orb.to} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={hero} height={hero} fill="url(#halo)" />
            </Svg>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: orbScale }] }}>
            <AIOrb size="hero" listening={phase === 'listening' || phase === 'thinking'} />
          </Animated.View>
        </View>

        {/* ชื่อ + สถานะ */}
        <View style={{ alignItems: 'center', gap: space[1] }}>
          <Text variant="headlineMd" style={{ fontFamily: fontFamily.bold }} align="center">
            ผู้ช่วย ThaiWell
          </Text>
          <Text variant="bodyMd" tone="tertiary" align="center">
            {STATUS[phase]}
          </Text>
        </View>

        {/* ปุ่มหลักแคปซูลไล่สี */}
        <GradientPill
          label={phase === 'idle' ? 'เริ่มคุยด้วยเสียง' : phase === 'listening' ? 'จบการสนทนา' : phase === 'thinking' ? 'กำลังสรุป…' : 'ดูสรุปในแชท'}
          icon={phase === 'idle' ? 'mic' : phase === 'listening' ? 'phone-off' : phase === 'thinking' ? 'loader' : 'message-circle'}
          danger={phase === 'listening'}
          onPress={() => (phase === 'idle' ? start() : phase === 'listening' ? setPhase('thinking') : phase === 'done' ? nav.goBack() : undefined)}
        />

        {/* คำบรรยายสด */}
        <View style={{ minHeight: t.captionMinHeight, alignSelf: 'stretch', alignItems: 'center', gap: space[2] }}>
          {phase === 'idle' ? (
            <Text variant="bodySm" tone="tertiary" align="center">
              เล่าอาการได้ตามสบาย ผู้ช่วยจะถามเฉพาะที่จำเป็น{'\n'}ใช้เวลาประมาณ 2 นาที
            </Text>
          ) : phase === 'thinking' ? (
            <LatticeLoader status="working" label="กำลังสรุปอาการ" fontSize={15} cellSize={7} />
          ) : phase === 'listening' ? (
            <>
              {prev ? (
                <Text variant="bodySm" tone="tertiary" align="center" numberOfLines={2}>
                  {prev.from === 'user' ? 'คุณ: ' : ''}
                  {prev.text}
                </Text>
              ) : null}
              <Text variant="titleMd" align="center" color={current.from === 'ai' ? colors.ai.fg : colors.text.primary}>
                {current.from === 'user' ? 'คุณ: ' : ''}
                {current.text}
              </Text>
            </>
          ) : (
            <View style={{ alignItems: 'center', gap: space[1] }}>
              <Text variant="titleSm" align="center">
                ปวดตึงบ่าขวา · 6/10 · 3 วัน
              </Text>
              <Text variant="bodySm" tone="tertiary" align="center">
                ไม่พบสัญญาณอันตราย · ส่งให้ผู้ให้บริการตรวจสอบแล้ว
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* กลุ่มปุ่มกลมลอย */}
      <View style={{ alignItems: 'center', paddingBottom: space[4] }}>
        <View
          style={{
            flexDirection: 'row',
            gap: space[2],
            padding: t.actionGroupPadding,
            borderRadius: radius.full,
            backgroundColor: colors.surface.default,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            shadowColor: colors.orb.to,
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <RoundAction icon="message-square" label="พิมพ์ในแชทแทน" onPress={() => nav.goBack()} />
          <RoundAction icon="rotate-ccw" label="เริ่มใหม่" onPress={start} />
          <RoundAction icon="user" label="ระบุตำแหน่งบนร่างกาย" onPress={() => nav.navigate('BodyMap')} />
        </View>
      </View>
    </View>
  );
}

/** ปุ่มกลมในกลุ่มลอย (ref: share / retry / compass) */
function RoundAction({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  const d = componentTokens.voice.actionBtn;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.ai.bg : colors.surface.default,
        borderWidth: 1,
        borderColor: colors.ai.bg,
        shadowColor: colors.orb.to,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      })}
    >
      <Icon name={icon} size="lg" color={colors.text.primary} />
    </Pressable>
  );
}
