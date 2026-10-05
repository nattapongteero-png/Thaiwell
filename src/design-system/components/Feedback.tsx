import React from 'react';
import { View } from 'react-native';
import { componentTokens, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'brand';

function useToneColors(tone: Tone) {
  const { colors } = useTheme();
  switch (tone) {
    case 'success':
    case 'warning':
    case 'danger':
    case 'info':
      return colors.status[tone];
    case 'ai':
      return { fg: colors.ai.fg, bg: colors.ai.bg, border: colors.ai.border, solid: colors.ai.fg, onSolid: colors.text.inverse };
    case 'brand':
      return { fg: colors.brand.onSubtle, bg: colors.brand.subtle, border: colors.brand.subtle, solid: colors.brand.primary, onSolid: colors.brand.onPrimary };
    default:
      return { fg: colors.text.secondary, bg: colors.surface.sunken, border: colors.border.subtle, solid: colors.text.secondary, onSolid: colors.text.inverse };
  }
}

export function Badge({ label, tone = 'neutral', icon, solid }: { label: string; tone?: Tone; icon?: IconName; solid?: boolean }) {
  const c = useToneColors(tone);
  const t = componentTokens.badge;
  return (
    <View
      style={{
        height: t.height,
        paddingHorizontal: t.paddingX,
        borderRadius: t.radius,
        backgroundColor: solid ? c.solid : c.bg,
        borderWidth: 1,
        borderColor: solid ? c.solid : c.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size="xs" color={solid ? c.onSolid : c.fg} /> : null}
      <Text variant="labelSm" color={solid ? c.onSolid : c.fg}>
        {label}
      </Text>
    </View>
  );
}

/**
 * SafetyLevel — Traffic light จาก Safety Rule Engine
 * สื่อความหมายด้วย "สี + ไอคอน + ข้อความ" เสมอ (ไม่พึ่งสีอย่างเดียว — WCAG 1.4.1)
 */
export type SafetyLevel = 'green' | 'amber' | 'red';
export const safetyMeta: Record<SafetyLevel, { tone: Tone; icon: IconName; label: string; short: string }> = {
  green: { tone: 'success', icon: 'check-circle', label: 'พร้อมรับบริการ', short: 'ปกติ' },
  amber: { tone: 'warning', icon: 'alert-triangle', label: 'มีข้อควรระวัง', short: 'ระวัง' },
  red: { tone: 'danger', icon: 'x-octagon', label: 'Red Flag — ควรพบแพทย์ก่อน', short: 'Red Flag' },
};

export function SafetyTag({ level, solid }: { level: SafetyLevel; solid?: boolean }) {
  const m = safetyMeta[level];
  return <Badge label={m.short} tone={m.tone} icon={m.icon} solid={solid} />;
}

/** Banner — ข้อความสำคัญระดับหน้า (Von Restorff Effect: ต้องต่างจากเนื้อหาอื่นชัดเจน) */
export function Banner({
  tone = 'info',
  title,
  message,
  icon,
  action,
}: {
  tone?: Tone;
  title: string;
  message?: string;
  icon?: IconName;
  action?: React.ReactNode;
}) {
  const c = useToneColors(tone);
  const t = componentTokens.banner;
  const defaultIcon: IconName = tone === 'danger' ? 'x-octagon' : tone === 'warning' ? 'alert-triangle' : tone === 'success' ? 'check-circle' : tone === 'ai' ? 'cpu' : 'info';
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={{
        borderRadius: t.radius,
        padding: t.padding,
        backgroundColor: c.bg,
        borderWidth: 1,
        borderColor: c.border,
        borderLeftWidth: 4,
        borderLeftColor: c.solid,
        flexDirection: 'row',
        gap: t.gap,
      }}
    >
      <Icon name={icon ?? defaultIcon} color={c.fg} />
      <View style={{ flex: 1, gap: space[1] }}>
        <Text variant="titleSm" color={c.fg}>
          {title}
        </Text>
        {message ? (
          <Text variant="bodySm" tone="primary">
            {message}
          </Text>
        ) : null}
        {action}
      </View>
    </View>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ gap: space[1] }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      {label ? (
        <Text variant="labelSm" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: colors.brand.primary, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

/**
 * JourneyStepper — 5 ขั้นของ Digital Thai Wellness Journey
 * Goal-Gradient Effect: เห็นว่าใกล้ถึงเป้าหมาย → มีแรงทำต่อ
 */
export const JOURNEY_STEPS = ['คัดกรอง', 'ความปลอดภัย', 'แผนการดูแล', 'รับบริการ', 'ติดตามผล'] as const;

export function JourneyStepper({ current, steps = JOURNEY_STEPS as unknown as string[] }: { current: number; steps?: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space[2] }} accessibilityLabel={`ขั้นที่ ${current + 1} จาก ${steps.length}: ${steps[current]}`}>
      <View style={{ flexDirection: 'row', gap: space[1] }}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: i <= current ? colors.brand.primary : colors.border.subtle,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="labelSm" tone="secondary">
          ขั้นที่ {current + 1}/{steps.length}
        </Text>
        <Text variant="labelSm" tone="primary">
          {steps[current]}
        </Text>
      </View>
    </View>
  );
}

/** EmptyState — ให้คำแนะนำขั้นถัดไปเสมอ ไม่ปล่อยหน้าว่าง */
export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space[8], gap: space[3] }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size="xl" color={colors.icon.secondary} />
      </View>
      <Text variant="titleMd" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="bodySm" tone="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
