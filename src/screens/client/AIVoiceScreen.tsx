import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientPill, Icon, IconButton, LatticeLoader, Text, componentTokens, radius, space, useGrid, useTheme, type IconName } from '../../design-system';
import { useNav } from '../../navigation/types';
import { AudioQuality, IOSOutputFormat, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type AudioPlayer } from 'expo-audio';
import { friendReply, heardSoFar, speak, summarizeTalk, transcribe, type Heard, type VoiceTurn } from '../../services/voiceAI';
import { EMERGENCY } from '../../data/emergency';
import { VoiceRibbon } from '../../design-system/components/VoiceRibbon';

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
/** ขนาดลูกแก้ว AI กลางจอ */
const BALL = 104;
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
  const [caught, setCaught] = React.useState<Heard | null>(null);
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
      // จับข้อมูลที่เล่ามาแล้ว (คู่ขนานกับคำตอบ ไม่ให้รอ)
      void heardSoFar(next)
        .then((h) => alive.current && setCaught(h))
        .catch(() => undefined);
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
    setCaught(null);
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

  const busy = phase === 'transcribing' || phase === 'thinking' || phase === 'summarizing';
  const canSummarize = turns.some((x) => x.from === 'user') && !busy && phase !== 'summary' && phase !== 'emergency';
  // คลื่นเสียงจากไมค์จริง (dBFS → 0–1)
  const level = phase === 'listening' ? Math.max(0, Math.min(1, ((rec.metering ?? -60) + 55) / 40)) : 0;
  // ระดับที่ใช้กับแสง: ฟัง = เสียงผู้ใช้จริง · ไทยเวลพูด = กลาง ๆ · อื่น ๆ = เงียบ (เส้นนิ่ง ขยับนิดเดียว)
  const vol = phase === 'listening' ? level : phase === 'speaking' ? 0.5 : 0;
  // ชิปสิ่งที่จับได้ (ว่าง = เส้นประ ยังไม่ได้เล่า)
  const chips: { key: keyof Heard; label: string; value: string | null }[] = [
    { key: 'area', label: 'ตรงไหน', value: caught?.area ?? null },
    { key: 'pain', label: 'ปวดแค่ไหน', value: caught?.pain != null ? `${caught.pain}/10` : null },
    { key: 'duration', label: 'นานแค่ไหน', value: caught?.duration ?? null },
    { key: 'cause', label: 'สาเหตุ', value: caught?.cause ?? null },
  ];

  const lastAi = [...turns].reverse().find((x) => x.from === 'ai');
  const lastUser = [...turns].reverse().find((x) => x.from === 'user');

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.canvas, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space[3]) }}>
      {/* แถบบน */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[2] }}>
        <IconButton icon="x" label="ปิด" onPress={() => (void stopAll(), nav.goBack())} />
        <Text variant="labelLg">คุยกับไทยเวล</Text>
        <IconButton icon="type" label="พิมพ์ในแชทแทน" onPress={() => (void stopAll(), nav.goBack())} />
      </View>

      {/* สิ่งที่ไทยเวลจับได้ — ครบ = พร้อมสรุป */}
      <View style={{ height: 44, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: space[4] }}>
        {turns.length
          ? chips.map((c) => (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: c.value ? colors.brand.subtle : 'transparent', borderWidth: c.value ? 0 : 1, borderStyle: 'dashed', borderColor: colors.border.default }}>
                {c.value ? <Icon name="check" size="xs" color={colors.brand.primary} /> : null}
                <Text variant="labelSm" color={c.value ? colors.brand.primary : colors.text.tertiary}>
                  {c.value ?? c.label}
                </Text>
              </View>
            ))
          : null}
      </View>

      {/* คำบรรยาย: สิ่งที่พูดล่าสุด (เล็ก) + ไทยเวล (ใหญ่) · สรุป */}
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: space[6], gap: space[2], paddingBottom: space[4] }}>
        {phase === 'summary' ? (
          <View style={{ gap: space[2], padding: space[5], borderRadius: 24, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
            <Text variant="labelSm" tone="secondary">
              สรุปจากที่คุยกัน
            </Text>
            <Text variant="titleSm">{summary}</Text>
            <Text variant="bodyXs" tone="tertiary">
              ในแชทจะถามต่อเฉพาะข้อที่ยังขาด รวมถึงข้อห้ามนวด
            </Text>
          </View>
        ) : !turns.length ? (
          <>
            <Text variant="bodyMd" tone="tertiary" align="center">
              สวัสดีค่ะ
            </Text>
            <Text variant="headlineSm" align="center">
              วันนี้เป็นยังไงบ้าง{'\n'}เหนื่อยหรือปวดตรงไหนคะ
            </Text>
          </>
        ) : (
          <>
            {lastUser ? (
              <Text variant="bodySm" tone="tertiary" align="center" numberOfLines={2}>
                “{lastUser.text}”
              </Text>
            ) : null}
            {lastAi ? (
              <Text variant="headlineSm" align="center" numberOfLines={4} color={phase === 'emergency' ? colors.status.danger.fg : colors.text.primary}>
                {lastAi.text}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* ริบบิ้นอนุภาคตามเสียง: เงียบ = เส้นบางเกือบตรง · พูด = พลิ้วเป็นคลื่น */}
      <VoiceRibbon level={vol} style={{ height: 200 }} />

      {/* สถานะ */}
      <View style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? (
          <ActivityIndicator color={colors.text.tertiary} />
        ) : (
          <Text variant="labelMd" align="center" color={phase === 'emergency' || phase === 'error' ? colors.status.danger.fg : colors.text.tertiary}>
            {STATUS[phase]}
          </Text>
        )}
      </View>

      {/* แถบควบคุม */}
      <View style={{ flex: 0.6, justifyContent: 'flex-end' }}>
        {phase === 'summary' ? (
          <View style={{ gap: space[2], paddingHorizontal: space[5] }}>
            <GradientPill label="ประเมินต่อในแชท" icon="message-circle" onPress={toChat} />
            <Pressable accessibilityRole="button" onPress={() => void listen()} style={{ alignItems: 'center', paddingVertical: space[2] }}>
              <Text variant="labelMd" tone="secondary">
                คุยต่ออีกหน่อย
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: space[8] }}>
            <SideAction icon="rotate-ccw" label="เริ่มใหม่" disabled={!turns.length} onPress={() => void stopAll().then(start)} />
            <MicButton phase={phase} onPress={phase === 'emergency' ? () => nav.navigate('RedFlag', { reason: 'อาการที่เล่าในโหมดเสียง' }) : tapOrb} />
            <SideAction icon="check" label="สรุป" disabled={!canSummarize} onPress={() => void summarize()} />
          </View>
        )}
      </View>
    </View>
  );
}

/** ปุ่มไมค์หลัก: ว่าง = เริ่มพูด · ฟัง = ส่งที่พูด · AI พูด = ขัดแล้วพูดต่อ · ฉุกเฉิน = ดูคำแนะนำ */
function MicButton({ phase, onPress }: { phase: Phase; onPress: () => void }) {
  const { colors } = useTheme();
  const busy = phase === 'transcribing' || phase === 'thinking' || phase === 'summarizing';
  const icon: IconName = phase === 'listening' ? 'arrow-up' : phase === 'speaking' ? 'pause' : phase === 'emergency' ? 'alert-triangle' : 'mic';
  const label = phase === 'listening' ? 'ส่งที่พูด' : phase === 'speaking' ? 'หยุดแล้วพูด' : phase === 'emergency' ? 'ดูคำแนะนำ' : phase === 'idle' ? 'เริ่มคุย' : 'พูด';
  const bg = phase === 'emergency' ? colors.status.danger.fg : colors.text.primary;
  return (
    <View style={{ alignItems: 'center', gap: space[2] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: busy ? 0.35 : pressed ? 0.85 : 1, shadowColor: bg, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } })}
      >
        <Icon name={icon} size="lg" color="#FFFFFF" />
      </Pressable>
      <Text variant="labelSm" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** ปุ่มข้าง (เริ่มใหม่ · สรุป) */
function SideAction({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space[2], opacity: disabled ? 0.35 : 1, paddingTop: 11 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.surface.sunken : colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle })}>
        <Icon name={icon} size="md" color={colors.text.primary} />
      </Pressable>
      <Text variant="labelSm" tone="secondary">
        {label}
      </Text>
    </View>
  );
}
