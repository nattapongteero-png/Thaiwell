/**
 * TYPOGRAPHY TOKENS
 * ------------------------------------------------------------------
 * Font: IBM Plex Sans Thai (Open Font License, รองรับไทย+อังกฤษในไฟล์เดียว,
 *       มีหัวอ่านชัด เหมาะกับผู้สูงอายุ/ผู้รับบริการทั่วไป)
 *
 * Type scale อิง Material 3 (Display / Headline / Title / Body / Label)
 * ปรับ line-height ให้ ≥ 1.4–1.6 เท่าเพราะภาษาไทยมีสระบน-ล่าง + วรรณยุกต์
 * ขั้นต่ำเนื้อหา 15pt (bodyMd) — WCAG / Apple HIG แนะนำ ≥ 11pt label, ≥ 15-17pt body
 *
 * รองรับ Dynamic Type: component <Text> จำกัด maxFontSizeMultiplier = 1.6
 */

export const fontFamily = {
  regular: 'IBMPlexSansThai_400Regular',
  medium: 'IBMPlexSansThai_500Medium',
  semibold: 'IBMPlexSansThai_600SemiBold',
  bold: 'IBMPlexSansThai_700Bold',
} as const;

export type FontWeightToken = keyof typeof fontFamily;

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

const t = (weight: FontWeightToken, fontSize: number, lineHeight: number, letterSpacing = 0): TypeStyle => ({
  fontFamily: fontFamily[weight],
  fontSize,
  lineHeight,
  letterSpacing,
});

export const typeScale = {
  /** ตัวเลขใหญ่ เช่น Pain score, KPI */
  // display ทุกขนาด: lineHeight ≈ 1.45–1.6 เท่า เผื่อสระบน + วรรณยุกต์ซ้อน (เช่น นี้) ไม่ให้ iOS ตัดทิ้ง
  displayLg: t('bold', 40, 62, -0.5),
  displayMd: t('bold', 32, 50, -0.25),
  /** Figma: Pain score ตัวเลขหลัก 48 Bold */
  // lineHeight ต้องพอกับความสูงจริงของฟอนต์ไทย (ascent+descent ≈ 1.45 เท่า) ไม่งั้น iOS ตัดหัวตัวเลขทิ้ง
  displayXl: t('bold', 48, 70),

  headlineLg: t('semibold', 28, 40),
  headlineMd: t('semibold', 24, 36),
  headlineSm: t('semibold', 20, 30),

  /** Figma: ชื่อผู้ใช้ 20 Bold */
  titleXl: t('bold', 20, 30),
  titleLg: t('semibold', 18, 28),
  titleMd: t('semibold', 16, 24),
  titleSm: t('medium', 14, 22),
  /** Figma: หัวข้อย่อย 14 Bold (ชื่อธาตุ, % ในวง) */
  titleXs: t('bold', 14, 20),

  bodyLg: t('regular', 17, 28),
  bodyMd: t('regular', 15, 24),
  /** Figma: คำทักทาย 14 Regular */
  bodyBase: t('regular', 14, 20),
  bodySm: t('regular', 13, 20),
  /** Figma: label section 12 Regular */
  bodyXs: t('regular', 12, 18),

  labelLg: t('semibold', 15, 22, 0.1),
  labelMd: t('medium', 13, 20, 0.1),
  labelSm: t('medium', 11, 16, 0.4),
  /** Figma: chip / tab 11 Regular */
  labelXs: t('regular', 11, 16),
  /** Figma: คำอธิบายสั้น 10 Regular */
  caption: t('regular', 10, 14),

  /** Overline — หัวข้อหมวดตัวพิมพ์ใหญ่ (EN) */
  overline: t('semibold', 11, 16, 1),
} as const;

export type TypeVariant = keyof typeof typeScale;
