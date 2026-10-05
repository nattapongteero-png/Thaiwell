import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppBar,
  Banner,
  Button,
  ChatBubble,
  Chip,
  EntityChip,
  HStack,
  Icon,
  IconButton,
  JourneyStepper,
  Text,
  TypingIndicator,
  VStack,
  radius,
  regionLabel,
  sizing,
  space,
  typeScale,
  useGrid,
  useTheme,
} from '../../design-system';
import { INTERVIEW_SCRIPT, parseComplaint, type ExtractedComplaint } from '../../services/aiInterview';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

type Msg = { id: number; from: 'ai' | 'user'; text: string; entities?: ExtractedComplaint };

const emptyExtract: ExtractedComplaint = { regions: [], triggers: [], quality: [] };

function merge(a: ExtractedComplaint, b: ExtractedComplaint): ExtractedComplaint {
  return {
    regions: [...new Set([...a.regions, ...b.regions])],
    side: b.side ?? a.side,
    durationDays: b.durationDays ?? a.durationDays,
    severity: b.severity ?? a.severity,
    triggers: [...new Set([...a.triggers, ...b.triggers])],
    quality: [...new Set([...a.quality, ...b.quality])],
  };
}

/** 04 AI INTERVIEW */
export function InterviewScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const g = useGrid();
  const insets = useSafeAreaInsets();
  const { setSymptoms, symptoms, setChiefComplaint, setGoal, profile, setProfile, log } = useJourney();

  const [msgs, setMsgs] = React.useState<Msg[]>([{ id: 0, from: 'ai', text: INTERVIEW_SCRIPT[0].ask }]);
  const [turn, setTurn] = React.useState(0);
  const [typing, setTyping] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [extract, setExtract] = React.useState<ExtractedComplaint>(emptyExtract);
  const [done, setDone] = React.useState(false);
  const [flagged, setFlagged] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const idRef = React.useRef(1);

  const current = INTERVIEW_SCRIPT[turn];

  const send = (text: string) => {
    if (!text.trim() || typing || done) return;
    const parsed = parseComplaint(text);
    const next = merge(extract, parsed);
    const hasEntities = parsed.regions.length || parsed.durationDays || parsed.severity || parsed.triggers.length;
    setMsgs((m) => [...m, { id: idRef.current++, from: 'user', text, entities: hasEntities ? parsed : undefined }]);
    setExtract(next);
    setInput('');

    // side-effects ต่อ Journey state
    if (current.id === 'chief') setChiefComplaint(text);
    if (current.id === 'goal') setGoal(text);
    if (current.id === 'redflag' && /ชา|ไข้/.test(text)) {
      setFlagged(true);
      setProfile({
        ...profile,
        temperature: /ไข้/.test(text) ? 38.6 : profile.temperature,
        symptoms: { ...profile.symptoms, suddenNumbnessOrWeakness: /ชา/.test(text) || profile.symptoms.suddenNumbnessOrWeakness },
      });
    }

    // หา turn ถัดไปที่ยังขาดข้อมูล (adaptive)
    let n = turn + 1;
    while (n < INTERVIEW_SCRIPT.length && INTERVIEW_SCRIPT[n].skipIf?.(next)) n++;

    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      if (n >= INTERVIEW_SCRIPT.length) {
        setDone(true);
        setMsgs((m) => [...m, { id: idRef.current++, from: 'ai', text: 'ขอบคุณค่ะ สรุปข้อมูลเรียบร้อยแล้ว กรุณาตรวจสอบตำแหน่งอาการบนภาพร่างกายอีกครั้งนะคะ' }]);
        const s = { ...symptoms };
        next.regions.forEach((r) => (s[r] = next.severity ?? s[r] ?? 5));
        setSymptoms(s);
        log('AI', 'สร้าง Structured Summary จาก AI Interview');
      } else {
        const prefix = current.id === 'redflag' && /ชา|ไข้/.test(text) ? 'ขอบคุณที่แจ้งค่ะ ระบบจะให้ผู้ให้บริการตรวจสอบเรื่องนี้ก่อนเริ่มบริการ ' : '';
        setMsgs((m) => [...m, { id: idRef.current++, from: 'ai', text: prefix + INTERVIEW_SCRIPT[n].ask }]);
        setTurn(n);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }, 700);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const progress = Math.min(1, (turn + (done ? 1 : 0)) / INTERVIEW_SCRIPT.length);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppBar
        title="เล่าอาการกับผู้ช่วย AI"
        subtitle={`คำถาม ${Math.min(turn + 1, INTERVIEW_SCRIPT.length)}/${INTERVIEW_SCRIPT.length} · ถามเฉพาะที่จำเป็น`}
        onBack={() => nav.goBack()}
        right={<IconButton icon="list" label="สลับเป็นแบบฟอร์ม" onPress={() => nav.navigate('BodyMap')} />}
      />
      <View style={{ paddingHorizontal: g.margin, paddingVertical: space[2], backgroundColor: colors.surface.default }}>
        <JourneyStepper current={0} />
        <View style={{ height: 3, marginTop: space[2], backgroundColor: colors.surface.sunken, borderRadius: radius.full }}>
          <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: colors.ai.fg, borderRadius: radius.full }} />
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: g.margin, gap: space[3], maxWidth: g.maxContentWidth, width: '100%', alignSelf: 'center' }}>
        <Text variant="labelSm" tone="tertiary" align="center">
          🔒 ข้อมูลนี้ใช้เพื่อความปลอดภัยในการนวดเท่านั้น · AI ไม่วินิจฉัยโรค
        </Text>

        {msgs.map((m) => (
          <VStack key={m.id} gap={1}>
            <ChatBubble from={m.from}>{m.text}</ChatBubble>
            {m.entities ? (
              <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                <Text variant="labelSm" tone="tertiary">
                  AI เข้าใจว่า
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1], justifyContent: 'flex-end' }}>
                  {m.entities.regions.map((r) => (
                    <EntityChip key={r} label="ตำแหน่ง" value={regionLabel[r]} icon="map-pin" />
                  ))}
                  {m.entities.durationDays ? <EntityChip label="ระยะเวลา" value={`${m.entities.durationDays} วัน`} icon="clock" /> : null}
                  {m.entities.severity !== undefined ? <EntityChip label="ความปวด" value={`${m.entities.severity}/10`} icon="thermometer" /> : null}
                  {m.entities.triggers.map((t) => (
                    <EntityChip key={t} label="ปัจจัยกระตุ้น" value={t} icon="zap" />
                  ))}
                </View>
              </View>
            ) : null}
          </VStack>
        ))}
        {typing ? <TypingIndicator /> : null}

        {flagged ? (
          <Banner tone="warning" title="พบข้อมูลที่ต้องตรวจสอบเพิ่ม" message="ระบบคัดกรองความปลอดภัยจะแจ้งผลในหน้าสรุป — ผู้ให้บริการจะตรวจยืนยันก่อนเริ่มนวด" />
        ) : null}

        {done ? (
          <Button label="ตรวจสอบตำแหน่งบน Body Map" iconRight="arrow-right" onPress={() => nav.navigate('BodyMap')} />
        ) : null}
      </ScrollView>

      {!done ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border.subtle,
            backgroundColor: colors.surface.default,
            paddingHorizontal: g.margin,
            paddingTop: space[2],
            paddingBottom: Math.max(insets.bottom, space[2]),
            gap: space[2],
          }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
            {current.quickReplies.map((q) => (
              <Chip key={q} label={q} tone="ai" onPress={() => send(q)} />
            ))}
          </ScrollView>
          <HStack gap={2}>
            <View
              style={{
                flex: 1,
                minHeight: sizing.touchTargetMin,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: colors.border.default,
                paddingHorizontal: space[4],
                justifyContent: 'center',
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={listening ? 'กำลังฟัง… พูดได้เลย' : 'เช่น “ปวดบ่าข้างขวามาสามวัน”'}
                placeholderTextColor={colors.text.tertiary}
                onSubmitEditing={() => send(input)}
                returnKeyType="send"
                accessibilityLabel="พิมพ์อาการ"
                style={[typeScale.bodyMd, { color: colors.text.primary, paddingVertical: space[2] }]}
              />
            </View>
            {input ? (
              <IconButton icon="send" label="ส่ง" variant="filled" onPress={() => send(input)} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="พูดแทนการพิมพ์"
                onPress={() => {
                  // Mock Speech-to-Text
                  setListening(true);
                  setTimeout(() => {
                    setListening(false);
                    setInput(turn === 0 ? 'ปวดบ่าข้างขวามาสามวัน ตึงมากหลังนั่งทำงานคอมทั้งวัน' : current.quickReplies[0]);
                  }, 1200);
                }}
                style={{
                  width: sizing.touchTargetMin,
                  height: sizing.touchTargetMin,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: listening ? colors.status.danger.solid : colors.brand.primary,
                }}
              >
                <Icon name="mic" color={colors.brand.onPrimary} />
              </Pressable>
            )}
          </HStack>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
