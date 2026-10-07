import React, { createContext, useContext } from 'react';
import { PixelRatio, Platform, Text as RNText, StyleSheet, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { typeScale, type TypeVariant, type ColorTokens } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: keyof ColorTokens['text'];
  /** override สี (ใช้เฉพาะกรณีสีสถานะ เช่น colors.status.danger.fg) */
  color?: string;
  align?: TextStyle['textAlign'];
}

/** อยู่ใน <Text> อีกชั้น (ข้อความซ้อน) → ไม่จัดตำแหน่งซ้ำ */
const Nested = createContext(false);

/**
 * IBM Plex Sans Thai: กล่องฟอนต์สูง 1.65 เท่าของขนาด (ascent 1.116 · descent 0.534)
 * หัวสระ+วรรณยุกต์ซ้อนสูงสุด ≈ 1.11 เท่า (นี้ ตัวหนา)
 */
const FONT_BOX = 1.65;
const DESCENT = 0.534;
const INK_TOP = 1.12;
/**
 * ตัวไทยส่วนใหญ่สูงแค่ x-height (≈0.52 เท่า) ไอคอนสูงเกือบเท่าตัวอักษร → จัดกึ่งกลางทางเรขาคณิตแล้วตัวหนังสือยังดูลอยเหนือไอคอน
 * เลื่อนลงอีกนิดให้กึ่งกลางอยู่ที่ครึ่งความสูงตัวเลข/ตัวพิมพ์ใหญ่ (≈0.35 เท่า) แทน x-height (≈0.26 เท่า)
 * จำกัดไม่เกิน 1.5pt → แถวที่เรียงตามเส้นฐาน (ตัวเลขใหญ่ + หน่วยเล็ก) ต่างกันไม่ถึงครึ่ง pt
 */
const OPTICAL = 0.09;
const OPTICAL_MAX = 1.5;

const num = (...v: unknown[]) => {
  for (const x of v) if (x !== undefined) return typeof x === 'number' ? x : null;
  return 0;
};

/**
 * iOS: ถ้า lineHeight น้อยกว่ากล่องฟอนต์ iOS ตัดส่วนเกินจากด้านบนอย่างเดียว
 * → ตัวอักษรลอยสูงกว่าไอคอนข้าง ๆ 1–4px และหัววรรณยุกต์ซ้อน (นี้ ครั้ง) โดนตัด
 * แก้: ขยับตัวอักษรลงให้อยู่กึ่งกลางบรรทัดเหมือนเว็บ + เผื่อที่ด้านบนให้หัววรรณยุกต์ (padding) แล้วหักออกด้วย margin ติดลบ
 * → ขนาดใน layout เท่าเดิมทุกจุด ไม่ต้องแก้หน้าไหน
 */
function iosCenter(f: TextStyle, scaling: boolean): TextStyle | null {
  const fs = f.fontSize;
  const lh = f.lineHeight;
  if (!fs || !lh) return null;
  // มีพื้นหลัง/กรอบ/ความสูงกำหนดเอง → padding จะเห็นเป็นกล่องใหญ่ขึ้น ข้าม
  if (f.backgroundColor || f.borderWidth || f.height !== undefined) return null;
  const pt = num(f.paddingTop, f.paddingVertical, f.padding);
  const mt = num(f.marginTop, f.marginVertical, f.margin);
  const mb = num(f.marginBottom, f.marginVertical, f.margin);
  if (pt === null || mt === null || mb === null) return null; // เช่น marginTop: 'auto'
  // Dynamic Type ขยายทั้งขนาดและระยะบรรทัด (สัดส่วนเท่าเดิม) แต่ padding/margin ไม่ขยาย → คิดเป็นขนาดจริงบนจอ
  const k = scaling ? Math.min(PixelRatio.getFontScale(), 1.6) : 1;
  const size = fs * k;
  const line = lh * k;
  const box = size * FONT_BOX;
  if (line >= box) return null; // RN จัดกึ่งกลางให้เองแล้ว
  const shift = (box - line) / 2; // เลื่อนลงให้ตรงกับกึ่งกลางบรรทัด (เท่ากับบนเว็บ)
  const room = Math.max(0, Math.ceil(size * INK_TOP - (line - size * DESCENT + shift))); // ที่ว่างด้านบนที่ยังขาด
  return { paddingTop: pt + room + shift, marginTop: mt - room, marginBottom: mb - shift };
}

/**
 * Text — ใช้แทน <Text> ของ RN ทุกที่
 * - บังคับใช้ type scale (ห้ามกำหนด fontSize เอง)
 * - รองรับ Dynamic Type แต่จำกัดไม่เกิน 1.6x เพื่อไม่ให้ layout พัง
 * - iOS: จัดตัวอักษรไทยให้อยู่กึ่งกลางบรรทัด ไม่ลอยเหนือไอคอน และไม่ตัดหัววรรณยุกต์ (iosCenter)
 */
export function Text({ variant = 'bodyMd', tone = 'primary', color, align, style, ...rest }: TextProps) {
  const { colors, textScale } = useTheme();
  const nested = useContext(Nested);
  const base = [typeScale[variant], { color: color ?? colors.text[tone], textAlign: align }, style];
  // ตัวอักษรขนาดใหญ่: ขยายทั้งขนาดและระยะบรรทัดตามกัน (ภาษาไทยต้องมีระยะบรรทัดพอ ไม่ให้สระ/วรรณยุกต์โดนตัด)
  let scaled: TextStyle | undefined;
  const f = StyleSheet.flatten(base) as TextStyle;
  if (textScale !== 1) {
    scaled = { ...(f.fontSize ? { fontSize: f.fontSize * textScale } : null), ...(f.lineHeight ? { lineHeight: f.lineHeight * textScale } : null) };
  }
  const g = { ...f, ...scaled };
  const fix = Platform.OS === 'ios' && !nested ? iosCenter(g, rest.allowFontScaling !== false) : null;
  // ทุกแพลตฟอร์ม: เลื่อนลงทางสายตา (ไม่กระทบ layout) · ข้ามข้อความซ้อน/มีพื้นหลัง/วางตำแหน่งเอง
  const optical =
    !nested && g.fontSize && !g.backgroundColor && !g.borderWidth && g.position !== 'absolute' && g.top === undefined && g.bottom === undefined
      ? { top: Math.min(g.fontSize * (rest.allowFontScaling !== false && Platform.OS !== 'web' ? Math.min(PixelRatio.getFontScale(), 1.6) : 1) * OPTICAL, OPTICAL_MAX) }
      : null;
  const styles = [...base, scaled, fix, optical];
  if (nested) return <RNText maxFontSizeMultiplier={1.6} {...rest} style={styles} />;
  return (
    <Nested.Provider value>
      <RNText maxFontSizeMultiplier={1.6} {...rest} style={styles} />
    </Nested.Provider>
  );
}
