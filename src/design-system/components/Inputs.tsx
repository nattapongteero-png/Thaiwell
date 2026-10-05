import React from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { componentTokens, radius, sizing, space, typeScale } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/* ------------------------------------------------------------------ Chip */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = 'default',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: 'default' | 'ai';
}) {
  const { colors } = useTheme();
  const t = componentTokens.chip;
  const bg = selected ? colors.brand.primary : tone === 'ai' ? colors.ai.bg : colors.surface.default;
  const fg = selected ? colors.brand.onPrimary : tone === 'ai' ? colors.ai.fg : colors.text.primary;
  const border = selected ? colors.brand.primary : tone === 'ai' ? colors.ai.border : colors.border.default;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: t.height,
        paddingHorizontal: t.paddingX,
        borderRadius: t.radius,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.gap,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {selected ? <Icon name="check" size="sm" color={fg} /> : icon ? <Icon name={icon} size="sm" color={fg} /> : null}
      <Text variant="labelMd" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

/** ChipGroup — multi/single select. แนะนำ ≤ 6–8 ตัวเลือก (Hick's Law / Miller's Law) */
export function ChipGroup({
  options,
  value,
  onChange,
  multiple,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((o) => {
        const sel = value.includes(o);
        return (
          <Chip
            key={o}
            label={o}
            selected={sel}
            onPress={() => onChange(multiple ? (sel ? value.filter((v) => v !== o) : [...value, o]) : [o])}
          />
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- TextField */

export function TextField({
  label,
  helper,
  error,
  iconLeft,
  multiline,
  ...rest
}: TextInputProps & { label?: string; helper?: string; error?: string; iconLeft?: IconName }) {
  const { colors } = useTheme();
  const [focus, setFocus] = React.useState(false);
  const t = componentTokens.input;
  return (
    <View style={{ gap: space[1] }}>
      {label ? <Text variant="labelMd">{label}</Text> : null}
      <View
        style={{
          minHeight: multiline ? 96 : t.height,
          borderRadius: t.radius,
          borderWidth: focus ? 2 : 1,
          borderColor: error ? colors.status.danger.solid : focus ? colors.border.focus : colors.border.default,
          backgroundColor: colors.surface.default,
          paddingHorizontal: t.paddingX,
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: space[2],
        }}
      >
        {iconLeft ? <Icon name={iconLeft} color={colors.icon.secondary} /> : null}
        <TextInput
          placeholderTextColor={colors.text.tertiary}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          multiline={multiline}
          accessibilityLabel={label}
          {...rest}
          style={[typeScale.bodyMd, { flex: 1, color: colors.text.primary, paddingVertical: space[3], textAlignVertical: multiline ? 'top' : 'center' }]}
        />
      </View>
      {error || helper ? (
        <Text variant="bodySm" color={error ? colors.status.danger.fg : colors.text.secondary}>
          {error ?? helper}
        </Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------- Checkbox / Radio / Switch */

export function Checkbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', gap: space[3], minHeight: sizing.touchTargetMin, alignItems: 'flex-start', paddingVertical: space[2] }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.xs,
          borderWidth: 2,
          borderColor: checked ? colors.brand.primary : colors.border.strong,
          backgroundColor: checked ? colors.brand.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Icon name="check" size="sm" color={colors.brand.onPrimary} /> : null}
      </View>
      <View style={{ flex: 1, gap: space[0.5] }}>
        <Text variant="bodyMd">{label}</Text>
        {description ? (
          <Text variant="bodySm" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; description?: string }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            onPress={() => onChange(o.value)}
            style={{
              flexDirection: 'row',
              gap: space[3],
              padding: space[3],
              minHeight: sizing.touchTargetMin,
              borderRadius: radius.md,
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? colors.border.focus : colors.border.default,
              backgroundColor: colors.surface.default,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: sel ? colors.brand.primary : colors.border.strong,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sel ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand.primary }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMd">{o.label}</Text>
              {o.description ? (
                <Text variant="bodySm" tone="secondary">
                  {o.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={{
        width: 52,
        height: 32,
        borderRadius: radius.full,
        padding: 3,
        backgroundColor: value ? colors.brand.primary : colors.border.default,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.surface.default,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

/* ----------------------------------------------------- SegmentedControl */

export function SegmentedControl({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: colors.surface.sunken, borderRadius: radius.md, padding: space[1], gap: space[1] }}
    >
      {options.map((o) => {
        const sel = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: sel ? colors.surface.default : 'transparent',
              borderWidth: sel ? 1 : 0,
              borderColor: colors.border.subtle,
            }}
          >
            <Text variant="labelMd" tone={sel ? 'primary' : 'secondary'}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------------------------------------------------------- ScaleSelector */

/**
 * ScaleSelector — Numeric Rating Scale 0–10 (มาตรฐานวัด Pain Score ทางคลินิก)
 * - แสดง anchor text ปลายทั้งสองข้าง (ไม่ปวด ↔ ปวดมากที่สุด)
 * - cell ≥ 44pt กดง่าย (Fitts's Law)
 */
export function ScaleSelector({
  value,
  onChange,
  min = 0,
  max = 10,
  minLabel = 'ไม่มีอาการ',
  maxLabel = 'มากที่สุด',
  label,
  compareValue,
}: {
  value?: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  label?: string;
  /** แสดงค่าก่อนหน้า (เช่น ก่อนนวด) เป็นจุดอ้างอิง */
  compareValue?: number;
}) {
  const { colors } = useTheme();
  const items = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text variant="titleSm">{label}</Text>
          <Text variant="titleMd">{value ?? '–'}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 3 }} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value }}>
        {items.map((n) => {
          const sel = n === value;
          const isCompare = n === compareValue;
          return (
            <Pressable
              key={n}
              accessibilityLabel={`${n}`}
              onPress={() => onChange(n)}
              style={{
                flex: 1,
                minHeight: componentTokens.scale.cell,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sel ? colors.brand.primary : colors.surface.default,
                borderWidth: isCompare && !sel ? 2 : 1,
                borderStyle: isCompare && !sel ? 'dashed' : 'solid',
                borderColor: sel ? colors.brand.primary : isCompare ? colors.border.strong : colors.border.default,
              }}
            >
              <Text variant="labelMd" color={sel ? colors.brand.onPrimary : colors.text.primary}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="labelSm" tone="tertiary">
          {min} {minLabel}
        </Text>
        {compareValue !== undefined ? (
          <Text variant="labelSm" tone="secondary">
            ┆ ก่อนนวด = {compareValue}
          </Text>
        ) : null}
        <Text variant="labelSm" tone="tertiary">
          {max} {maxLabel}
        </Text>
      </View>
    </View>
  );
}

/** EmojiScale — 5 ระดับแบบใช้ภาพ (สำหรับผู้สูงอายุ/อ่านน้อย เช่น ความเครียด การนอน) */
export function FaceScale({ value, onChange, labels }: { value?: number; onChange: (v: number) => void; labels: [string, string, string, string, string] }) {
  const { colors } = useTheme();
  const faces: IconName[] = ['frown', 'frown', 'meh', 'smile', 'smile'];
  return (
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      {labels.map((l, i) => {
        const sel = value === i + 1;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={l}
            onPress={() => onChange(i + 1)}
            style={{
              flex: 1,
              paddingVertical: space[2],
              borderRadius: radius.md,
              alignItems: 'center',
              gap: space[1],
              borderWidth: sel ? 2 : 1,
              borderColor: sel ? colors.border.focus : colors.border.default,
              backgroundColor: sel ? colors.brand.subtle : colors.surface.default,
            }}
          >
            <Icon name={faces[i]} size="lg" color={sel ? colors.brand.onSubtle : colors.icon.secondary} />
            <Text variant="labelSm" tone={sel ? 'primary' : 'secondary'} align="center">
              {l}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
