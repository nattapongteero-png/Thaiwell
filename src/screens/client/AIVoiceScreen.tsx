import React from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { AIOrb, GradientPill, Icon, IconButton, LatticeLoader, Text, componentTokens, fontFamily, radius, space, useGrid, useTheme, type IconName } from '../../design-system';
import { useNav } from '../../navigation/types';
import { AudioQuality, IOSOutputFormat, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type AudioPlayer } from 'expo-audio';
import { friendReply, speak, summarizeTalk, transcribe, type VoiceTurn } from '../../services/voiceAI';
import { EMERGENCY } from '../../data/emergency';

/**
 * คุยด้วยเสียงกับ ThaiWell AI — เหมือนคุยกับเพื่อนเพื่อระบายอาการ แล้ว AI สรุปให้ในรอบเดียว
 * ฟัง (จับช่วงเงียบตัดประโยค) → ถอดเสียง → ตอบสั้นแบบเพื่อน (อ่านออกเสียง) → ฟังต่อเอง · "สรุปให้หน่อย" → สรุปเป็นข้อความ
 * → ส่งเข้าแชทประเมินเดิม: ระบบดึงอาการ/คะแนน/ระยะเวลา แล้วถามข้อที่ยังขาด (ข้อห้ามนวดถามตรงทุกครั้ง · กฎคัดกรองเดิมตัดสิน)
 * อาการฉุกเฉินในคำพูด → หยุดคุย เตือนทันที (กฎตายตัว ไม่รอ AI)
 */
type Phase = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'summarizing' | 'summary' | 'emergency' | 'error';

const STATUS: Record<Phase, string> = {
  idle: 'เล่าได้ตามสบาย เหมือนคุยกับเพื่อน',
  listening: 'กำลังฟัง… พูดได้เลยค่ะ',
  transcribing: 'กำลังฟังให้ชัด…',
  thinking: 'กำลังคิด…',
  speaking: 'ไทยเวลกำลังพูด',
  summarizing: 'กำลังสรุปสิ่งที่คุณเล่า…',
  summary: 'สรุปจากที่คุยกัน',
  emergency: 'ควรพบแพทย์ทันที',
  error: 'เชื่อมต่อไม่ได้ ลองอีกครั้งนะคะ',
};
const GREETING = 'สวัสดีค่ะ วันนี้เป็นยังไงบ้าง เหนื่อยหรือปวดตรงไหน เล่าให้ฟังได้เลยนะคะ';
/** WAV 16 kHz mono (Qwen3-ASR ต้องการ) · เปิดวัดระดับเสียงไว้จับช่วงเงียบ */
const REC_OPTIONS = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: { extension: '.wav', outputFormat: IOSOutputFormat.LINEARPCM, audioQuality: AudioQuality.MAX, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  android: { extension: '.m4a', outputFormat: 'mpeg4' as const, audioEncoder: 'aac' as const },
  web: { mimeType: 'audio/webm' },
};
/** เงียบหลังพูดนานเท่านี้ = จบประโยค (ms) · พูดยาวสุดต่อรอบ */
const SILENCE_MS = 1400;
const MAX_TURN_MS = 40000;

export function AIVoiceScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const g = useGrid();
  const insets = useSafeAreaInsets();
  const t = componentTokens.voice;
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [turns, setTurns] = React.useState<VoiceTurn[]>([]);
  const [summary, setSummary] = React.useState('');
  const recorder = useAudioRecorder(REC_OPTIONS);
  const rec = useAudioRecorderState(recorder, 120);
  const player = React.useRef<AudioPlayer | null>(null);
  const turnsRef = React.useRef<VoiceTurn[]>([]);
  turnsRef.current = turns;
  const alive = React.useRef(true);
  React.useEffect(
    () => () => {
      alive.current = false;
      player.current?.remove();
      if (recorder.isRecording) void recorder.stop().catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ลูกแก้วหายใจ (ฟัง/พูด = เร็วและกว้างกว่า)
  const pulse = React.useRef(new Animated.Value(0)).current;
  const lively = phase === 'listening' || phase === 'speaking';
  React.useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: lively ? 700 : 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: lively ? 700 : 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lively, pulse]);
  const amp = lively ? 0.08 : 0.03;
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amp] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.25 + amp] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [lively ? 0.45 : 0.2, 0] });

  /** พูดออกเสียง แล้ว (ถ้ายังคุยอยู่) เปิดฟังต่อเอง · พูดไม่ได้ = แสดงเป็นตัวหนังสืออย่างเดียว */
  const say = async (text: string, thenListen = true) => {
    setPhase('speaking');
    try {
      const uri = await speak(text);
      if (!alive.current) return;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      player.current?.remove();
      const p = createAudioPlayer(uri);
      player.current = p;
      await new Promise<void>((resolve) => {
        const sub = p.addListener('playbackStatusUpdate', (st) => {
          if (st.didJustFinish) {
            sub.remove();
            resolve();
          }
        });
        p.play();
        // กันค้าง: เสียงไม่จบเอง
        setTimeout(resolve, Math.min(30000, 2500 + text.length * 120));
      });
    } catch {
      /* พูดไม่ได้ → อ่านจากตัวหนังสือ */
    }
    if (alive.current && thenListen) void listen();
  };

  const listen = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setPhase('error');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    heard.current = false;
    silentFor.current = 0;
    startedAt.current = Date.now();
    floor.current = -50;
    await recorder.prepareToRecordAsync();
    recorder.record();
    if (alive.current) setPhase('listening');
  };

  /** จบประโยค → ถอดเสียง → (ฉุกเฉิน = หยุด) → เพื่อนตอบ → พูด → ฟังต่อ */
  const finishTurn = async () => {
    if (!recorder.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || !heard.current) return void listen();
    setPhase('transcribing');
    try {
      const text = await transcribe(uri);
      if (!alive.current) return;
      if (!text) return void listen();
      const next = [...turnsRef.current, { from: 'user' as const, text }];
      setTurns(next);
      if (EMERGENCY.test(text)) {
        const warn = 'อาการนี้อาจเป็นภาวะฉุกเฉินนะคะ โทร 1669 หรือไปโรงพยาบาลทันที ยังไม่ควรนวดค่ะ';
        setTurns([...next, { from: 'ai', text: warn }]);
        setPhase('emergency');
        void say(warn, false).then(() => alive.current && setPhase('emergency'));
        return;
      }
      setPhase('thinking');
      const reply = await friendReply(next);
      if (!alive.current) return;
      setTurns([...next, { from: 'ai', text: reply }]);
      void say(reply);
    } catch {
      if (alive.current) setPhase('error');
    }
  };

  // จับช่วงเงียบ: ระดับเสียงสูงกว่าพื้นหลังพอ = กำลังพูด · พูดแล้วเงียบนาน = จบประโยค
  const heard = React.useRef(false);
  const silentFor = React.useRef(0);
  const startedAt = React.useRef(0);
  const floor = React.useRef(-50);
  React.useEffect(() => {
    if (phase !== 'listening' || !rec.isRecording) return;
    const m = rec.metering ?? -160;
    if (!heard.current) floor.current = Math.min(-30, Math.max(-70, floor.current * 0.9 + m * 0.1));
    const speaking = m > Math.max(floor.current + 10, -42);
    if (speaking) {
      heard.current = true;
      silentFor.current = 0;
    } else if (heard.current) silentFor.current += 120;
    if ((heard.current && silentFor.current >= SILENCE_MS) || Date.now() - startedAt.current > MAX_TURN_MS) void finishTurn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.durationMillis]);

  const start = () => {
    setTurns([{ from: 'ai', text: GREETING }]);
    setSummary('');
    void say(GREETING);
  };
  const stopAll = async () => {
    player.current?.pause();
    if (recorder.isRecording) await recorder.stop().catch(() => undefined);
  };
  const summarize = async () => {
    await stopAll();
    if (!turnsRef.current.some((x) => x.from === 'user')) return setPhase('idle');
    setPhase('summarizing');
    try {
      const s = await summarizeTalk(turnsRef.current);
      if (alive.current) {
        setSummary(s);
        setPhase('summary');
      }
    } catch {
      if (alive.current) setPhase('error');
    }
  };
  // แตะลูกแก้ว: กำลังฟัง = ส่งที่พูดเลย · กำลังพูด = หยุดพูดแล้วฟัง · ว่าง/ผิดพลาด = เริ่มฟัง
  const tapOrb = () => {
    if (phase === 'listening') {
      heard.current = true;
      void finishTurn();
    } else if (phase === 'speaking') {
      player.current?.pause();
      void listen();
    } else if (phase === 'error') void listen();
    else if (phase === 'idle') start();
  };
  /** สรุปแล้ว → แชทประเมินเดิม (ดึงอาการจากข้อความ แล้วถามข้อที่ขาด) */
  const toChat = () => nav.popTo('ClientTabs', { screen: 'Home', params: { voiceText: summary } } as never);

  const hero = componentTokens.orb.hero;
  const busy = phase === 'transcribing' || phase === 'thinking' || phase === 'summarizing';
  const talking = phase === 'listening' || phase === 'speaking' || phase === 'transcribing' || phase === 'thinking' || phase === 'error';
  const lastAi = [...turns].reverse().find((x) => x.from === 'ai');
  const lastUser = [...turns].reverse().find((x) => x.from === 'user');

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.default, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space[4]) }}>
      {/* แถบบน */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[2] }}>
        <IconButton
          icon="x"
          label="ปิด"
          onPress={() => {
            void stopAll();
            nav.goBack();
          }}
        />
        <Text variant="labelMd" tone="secondary">
          โหมดเสียง
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ flex: 1, width: '100%', maxWidth: g.maxContentWidth, alignSelf: 'center', paddingHorizontal: space[6], alignItems: 'center', justifyContent: 'center', gap: space[6] }}>
        {/* ลูกแก้ว AI + รัศมีเรืองแสง · แตะ = ส่งที่พูด / ขัดจังหวะ */}
        <Pressable accessibilityRole="button" accessibilityLabel={phase === 'listening' ? 'ส่งที่พูด' : phase === 'speaking' ? 'หยุดแล้วพูดต่อ' : 'เริ่มฟัง'} onPress={tapOrb} disabled={busy || phase === 'summary' || phase === 'emergency'}>
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
              <AIOrb size="hero" listening={phase === 'listening' || busy} />
            </Animated.View>
          </View>
        </Pressable>

        {/* ชื่อ + สถานะ */}
        <View style={{ alignItems: 'center', gap: space[1] }}>
          <Text variant="headlineMd" style={{ fontFamily: fontFamily.bold }} align="center">
            ผู้ช่วย ThaiWell
          </Text>
          <Text variant="bodyMd" tone={phase === 'emergency' ? undefined : 'tertiary'} color={phase === 'emergency' ? colors.status.danger.fg : undefined} align="center">
            {STATUS[phase]}
          </Text>
        </View>

        {/* ปุ่มหลักแคปซูลไล่สี */}
        <GradientPill
          label={phase === 'idle' ? 'เริ่มคุยด้วยเสียง' : phase === 'summary' ? 'ประเมินต่อในแชท' : phase === 'emergency' ? 'ดูคำแนะนำ' : phase === 'summarizing' ? 'กำลังสรุป…' : 'สรุปให้หน่อย'}
          icon={phase === 'idle' ? 'mic' : phase === 'summary' ? 'message-circle' : phase === 'emergency' ? 'alert-triangle' : phase === 'summarizing' ? 'loader' : 'check'}
          danger={phase === 'emergency'}
          onPress={() =>
            phase === 'idle' ? start() : phase === 'summary' ? toChat() : phase === 'emergency' ? nav.navigate('RedFlag', { reason: 'อาการที่เล่าในโหมดเสียง' }) : phase === 'summarizing' ? undefined : void summarize()
          }
        />

        {/* คำบรรยายสด / สรุป */}
        <View style={{ minHeight: t.captionMinHeight, alignSelf: 'stretch', alignItems: 'center', gap: space[2] }}>
          {phase === 'idle' ? (
            <Text variant="bodySm" tone="tertiary" align="center">
              ปวดตรงไหน เหนื่อยแค่ไหน เล่าได้เลย{'\n'}แล้วกด "สรุปให้หน่อย" เพื่อประเมินต่อ
            </Text>
          ) : busy ? (
            <LatticeLoader status="working" label={phase === 'summarizing' ? 'กำลังสรุป' : phase === 'transcribing' ? 'กำลังฟัง' : 'กำลังคิด'} fontSize={15} cellSize={7} />
          ) : phase === 'summary' ? (
            <View style={{ alignSelf: 'stretch', gap: space[2], padding: space[4], borderRadius: radius.lg, backgroundColor: colors.ai.bg }}>
              <Text variant="bodyMd">{summary}</Text>
              <Text variant="bodyXs" tone="secondary">
                ในแชทจะถามต่อเฉพาะข้อที่ยังขาด รวมถึงข้อห้ามนวด
              </Text>
            </View>
          ) : (
            <>
              {lastUser ? (
                <Text variant="bodySm" tone="tertiary" align="center" numberOfLines={2}>
                  คุณ: {lastUser.text}
                </Text>
              ) : null}
              {lastAi ? (
                <Text variant="titleMd" align="center" color={phase === 'emergency' ? colors.status.danger.fg : colors.ai.fg}>
                  {lastAi.text}
                </Text>
              ) : null}
            </>
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
          <RoundAction
            icon="message-square"
            label="พิมพ์ในแชทแทน"
            onPress={() => {
              void stopAll();
              nav.goBack();
            }}
          />
          {phase === 'summary' ? (
            <RoundAction icon="mic" label="คุยต่อ" onPress={() => void listen()} />
          ) : (
            <RoundAction icon={talking ? 'mic' : 'mic-off'} label={phase === 'listening' ? 'ส่งที่พูด' : 'พูด'} onPress={tapOrb} />
          )}
          <RoundAction
            icon="rotate-ccw"
            label="เริ่มใหม่"
            onPress={() => {
              void stopAll().then(start);
            }}
          />
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
