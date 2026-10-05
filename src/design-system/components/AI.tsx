import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Sparkle from '../../../assets/figma/sparkle.svg';
import { componentTokens, radius, space, typeScale } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Badge } from './Feedback';
import { Icon, type IconName } from './Icon';
import { LatticeLoader } from './LatticeLoader';
import { Text } from './Text';

/**
 * AI COMPONENTS — หลัก AI Transparency / Human-in-the-loop
 * 1. ทุก output ของ AI ต้องติดป้าย "ข้อเสนอแนะจาก AI" (ไม่ใช่คำวินิจฉัย)
 * 2. ต้องแสดงแหล่งอ้างอิง (RAG) และเหตุผล (Reason Trace) ให้ตรวจสอบได้
 * 3. มนุษย์เป็นผู้ยืนยันเสมอ (Accept / Modify / Reject)
 */

export function AILabel({ text = 'ข้อเสนอแนะจาก AI' }: { text?: string }) {
  return <Badge label={text} tone="ai" icon="cpu" />;
}

export function ChatBubble({ from, children, time }: { from: 'ai' | 'user'; children: React.ReactNode; time?: string }) {
  const { colors } = useTheme();
  const t = componentTokens.chatBubble;
  const isAI = from === 'ai';
  return (
    <View style={{ flexDirection: 'row', justifyContent: isAI ? 'flex-start' : 'flex-end', gap: space[2], alignItems: 'flex-end' }}>
      {isAI ? (
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.ai.bg, borderWidth: 1, borderColor: colors.ai.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="cpu" size="sm" color={colors.ai.fg} />
        </View>
      ) : null}
      <View
        style={{
          maxWidth: `${t.maxWidthRatio * 100}%`,
          padding: t.padding,
          borderRadius: t.radius,
          borderBottomLeftRadius: isAI ? radius.xs : t.radius,
          borderBottomRightRadius: isAI ? t.radius : radius.xs,
          backgroundColor: isAI ? colors.surface.default : colors.brand.primary,
          borderWidth: isAI ? 1 : 0,
          borderColor: colors.border.subtle,
          gap: space[1],
        }}
      >
        {typeof children === 'string' ? (
          <Text variant="bodyMd" color={isAI ? colors.text.primary : colors.brand.onPrimary}>
            {children}
          </Text>
        ) : (
          children
        )}
        {time ? (
          <Text variant="labelSm" color={isAI ? colors.text.tertiary : colors.brand.onPrimary} style={{ opacity: 0.8 }}>
            {time}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** AI กำลังคิด — ใช้ LatticeLoader (React Bits) แทนจุดสามจุด */
export function TypingIndicator({ label = 'กำลังคิด' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: space[2], alignSelf: 'flex-start', marginLeft: 40 }}>
      <LatticeLoader status="working" label={label} />
    </View>
  );
}

/** Extracted entity chip — แสดงว่า AI "เข้าใจ" อะไรจากข้อความ (Postel's Law: รับภาษาธรรมชาติ → แปลงเป็นโครงสร้าง) */
export function EntityChip({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        paddingHorizontal: space[2],
        paddingVertical: space[1],
        borderRadius: radius.sm,
        backgroundColor: colors.ai.bg,
        borderWidth: 1,
        borderColor: colors.ai.border,
      }}
    >
      {icon ? <Icon name={icon} size="xs" color={colors.ai.fg} /> : null}
      <Text variant="labelSm" color={colors.ai.fg}>
        {label}:
      </Text>
      <Text variant="labelMd" color={colors.ai.fg}>
        {value}
      </Text>
    </View>
  );
}

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  section?: string;
}

export function SourceList({ sources }: { sources: SourceRef[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[1] }}>
      {sources.map((s, i) => (
        <View key={s.id} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
          <View style={{ minWidth: 20, height: 20, borderRadius: radius.xs, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="labelSm" tone="secondary">
              {i + 1}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm">{s.title}</Text>
            <Text variant="labelSm" tone="tertiary">
              {s.publisher}
              {s.section ? ` · ${s.section}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export interface TraceStep {
  kind: 'input' | 'rule' | 'retrieval' | 'ai' | 'human';
  text: string;
}

const traceIcon: Record<TraceStep['kind'], IconName> = {
  input: 'user',
  rule: 'shield',
  retrieval: 'book-open',
  ai: 'cpu',
  human: 'user-check',
};

/** ReasonTrace — Progressive disclosure: ซ่อนไว้ก่อน กดเพื่อดูว่า AI ใช้ข้อมูล/กฎอะไร */
export function ReasonTrace({ steps, defaultOpen }: { steps: TraceStep[]; defaultOpen?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <View style={{ gap: space[2] }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
        <Icon name="git-commit" size="sm" color={colors.text.secondary} />
        <Text variant="labelMd" tone="secondary">
          เหตุผลของ AI (Reason Trace)
        </Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.text.secondary} />
      </Pressable>
      {open ? (
        <View style={{ borderLeftWidth: 2, borderLeftColor: colors.border.default, marginLeft: 7, paddingLeft: space[3], gap: space[2] }}>
          {steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
              <Icon name={traceIcon[s.kind]} size="sm" color={colors.icon.secondary} />
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
                {s.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** ConfidenceMeter — บอกระดับความเหมาะสมเป็นแท่ง 5 ขั้น + ข้อความ (ไม่ใช้ % เพื่อลดความเชื่อมั่นเกินจริง) */
export function MatchMeter({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  const { colors } = useTheme();
  const text = ['ต่ำ', 'ค่อนข้างต่ำ', 'ปานกลาง', 'ค่อนข้างสูง', 'สูง'][level - 1];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: 10, height: 6, borderRadius: 2, backgroundColor: i <= level ? colors.ai.fg : colors.border.subtle }} />
        ))}
      </View>
      <Text variant="labelSm" tone="secondary">
        ความเหมาะสม {text}
      </Text>
    </View>
  );
}

/**
 * AIComposer — ปุ่ม AI (sparkle) + ช่องแชท ติดด้านล่างหน้าจอ (Figma: 45:1771)
 * - แตะปุ่ม sparkle = เริ่มคัดกรองเต็มรูปแบบกับ AI
 * - ช่องสีเทา = พิมพ์คุยกับผู้ช่วย (ส่งด้วย Enter / ปุ่มส่งที่ปรากฏเมื่อมีข้อความ)
 */
export function AIComposer({ onPress, onSend, placeholder }: { onPress: () => void; onSend?: (text: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  const t = componentTokens.composer;
  const [text, setText] = React.useState('');
  const send = () => {
    if (!text.trim() || !onSend) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[4] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="คุยกับผู้ช่วย AI"
        onPress={onPress}
        style={({ pressed }) => ({
          width: t.button,
          height: t.button,
          borderRadius: radius.full,
          backgroundColor: colors.text.tertiary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Sparkle width={24} height={24} />
      </Pressable>
      <View
        style={{
          flex: 1,
          height: t.height,
          borderRadius: t.radius,
          borderWidth: 1,
          borderColor: colors.text.tertiary,
          backgroundColor: colors.surface.sunken,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: space[4],
          paddingRight: space[2],
        }}
      >
        {onSend ? (
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            placeholder={placeholder}
            placeholderTextColor={colors.text.tertiary}
            accessibilityLabel="ข้อความถึงผู้ช่วย AI"
            style={[typeScale.bodySm, { flex: 1, color: colors.text.primary, height: '100%' }]}
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={placeholder ?? 'เล่าอาการให้ผู้ช่วย AI ฟัง'} onPress={onPress} style={{ flex: 1, height: '100%', justifyContent: 'center' }}>
            {placeholder ? (
              <Text variant="bodySm" tone="tertiary">
                {placeholder}
              </Text>
            ) : null}
          </Pressable>
        )}
        {onSend && text ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ส่ง"
            onPress={send}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-up" size="md" color={colors.brand.onPrimary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
