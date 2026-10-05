import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { typeScale, type TypeVariant, type ColorTokens } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: keyof ColorTokens['text'];
  /** override สี (ใช้เฉพาะกรณีสีสถานะ เช่น colors.status.danger.fg) */
  color?: string;
  align?: TextStyle['textAlign'];
}

/**
 * Text — ใช้แทน <Text> ของ RN ทุกที่
 * - บังคับใช้ type scale (ห้ามกำหนด fontSize เอง)
 * - รองรับ Dynamic Type แต่จำกัดไม่เกิน 1.6x เพื่อไม่ให้ layout พัง
 */
export function Text({ variant = 'bodyMd', tone = 'primary', color, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[typeScale[variant], { color: color ?? colors.text[tone], textAlign: align }, style]}
    />
  );
}
