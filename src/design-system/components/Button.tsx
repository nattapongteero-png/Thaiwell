import React from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { componentTokens, opacity, radius, sizing } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

/**
 * Button
 * - primary   : 1 ปุ่มต่อหน้าจอ (Hick's Law / Von Restorff) = action หลัก
 * - secondary : action รอง (outline)
 * - tertiary  : พื้นอ่อน
 * - ghost     : text button
 * - danger    : action ที่ย้อนกลับไม่ได้ / Red flag flow
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  iconLeft,
  iconRight,
  disabled,
  loading,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const t = componentTokens.button;

  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    // ภาษาเดียวกับหน้าแรก: ปุ่มหลัก = แคปซูลสีเข้ม (เช็กอิน / ให้คะแนน) · รอง = แคปซูลขาวขอบบาง (แก้ไข)
    primary: { bg: colors.text.primary, fg: colors.text.inverse, border: colors.text.primary },
    secondary: { bg: colors.surface.default, fg: colors.text.primary, border: colors.border.subtle },
    tertiary: { bg: colors.surface.sunken, fg: colors.text.primary, border: colors.surface.sunken },
    danger: { bg: colors.status.danger.solid, fg: colors.status.danger.onSolid, border: colors.status.danger.solid },
    ghost: { bg: 'transparent', fg: colors.text.link, border: 'transparent' },
  };
  const c = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        {
          height: t.height[size],
          minWidth: sizing.touchTargetMin,
          paddingHorizontal: t.paddingX[size],
          borderRadius: t.radius,
          backgroundColor: c.bg,
          borderWidth: 1,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.gap,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? opacity.disabled : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {/* ไอคอนเล็กกว่าตัวอักษรเล็กน้อย (16) → ไม่แย่งความเด่นจากคำบนปุ่ม */}
          {iconLeft ? <Icon name={iconLeft} size="sm" color={c.fg} /> : null}
          <Text variant={t.label[size]} color={c.fg} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size="sm" color={c.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

/** IconButton — hit area ≥ 48 เสมอแม้ icon จะเล็ก (Fitts's Law) */
export function IconButton({
  icon,
  onPress,
  label,
  variant = 'ghost',
}: {
  icon: IconName;
  onPress?: () => void;
  /** จำเป็นสำหรับ screen reader */
  label: string;
  variant?: 'ghost' | 'filled' | 'outline';
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: sizing.touchTargetMin,
        height: sizing.touchTargetMin,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variant === 'filled' ? colors.brand.subtle : pressed ? colors.surface.sunken : 'transparent',
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: colors.border.default,
      })}
    >
      <View>
        <Icon name={icon} size="lg" />
      </View>
    </Pressable>
  );
}
