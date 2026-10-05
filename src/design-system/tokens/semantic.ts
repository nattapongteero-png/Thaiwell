/**
 * TIER 2 — SEMANTIC TOKENS (System / Alias tokens)
 * ------------------------------------------------------------------
 * ตั้งชื่อตาม "หน้าที่" ไม่ใช่ "หน้าตา" เช่น `text.primary`, `surface.raised`,
 * `status.danger.bg` — component ใช้เฉพาะชั้นนี้
 *
 * มี 2 ธีม (สลับได้ทันทีใน Prototype):
 *   - wireframe : โทนเทาทั้งหมด (โฟกัส flow/โครงสร้าง ไม่ใช่ visual)
 *                 ยกเว้นสีสถานะความปลอดภัยที่ "ความหมาย" สำคัญ (คงไว้แบบจาง)
 *   - brand     : UI จริงตาม Figma (Teal + Gray) — ธีมเริ่มต้นของแอป
 *
 * เพิ่มธีมใหม่ (เช่น dark / high-contrast / kiosk) = เพิ่ม object ที่มี shape เดียวกัน
 */
import { palette as p } from './primitives';

type StatusSet = { fg: string; bg: string; border: string; solid: string; onSolid: string };

export interface ColorTokens {
  brand: { primary: string; primaryHover: string; onPrimary: string; subtle: string; onSubtle: string; accent: string; onAccent: string };
  surface: { canvas: string; default: string; raised: string; sunken: string; inverse: string; overlay: string };
  text: { primary: string; secondary: string; tertiary: string; disabled: string; inverse: string; link: string };
  border: { subtle: string; default: string; strong: string; focus: string };
  icon: { primary: string; secondary: string; inverse: string };
  /** Safety traffic light: success = ผ่าน, warning = ข้อควรระวัง, danger = Red Flag */
  status: { success: StatusSet; warning: StatusSet; danger: StatusSet; info: StatusSet };
  /** สีเฉพาะ AI — ให้ผู้ใช้แยกออกทันทีว่า "นี่คือข้อเสนอแนะจาก AI" (AI transparency) */
  ai: { fg: string; bg: string; border: string };
  /** Data-viz ordinal (Before / After / Trend) */
  chart: { before: string; after: string; trend: string; grid: string };
  /** Body map heat (ระดับอาการ 0-10) */
  heat: { none: string; low: string; mid: string; high: string };
  wire: { placeholder: string; placeholderStroke: string; annotation: string; annotationBorder: string; onAnnotation: string };
  /** พื้นรองใต้ dock / fade */
  gradient: { top: string; mid: string; bottom: string };
  /** การ์ดแก้วโปร่งแสงในแชท AI */
  glass: { bg: string; border: string; strong: string };
  /** ลูกแก้ว AI */
  orb: { from: string; to: string; core: string; glow: string };
  /** Floating capsule tab bar */
  dock: { bg: string; border: string; item: string; activeBg: string; activeFg: string };
}

export const wireframeColors: ColorTokens = {
  brand: {
    primary: p.neutral[900],
    primaryHover: p.neutral[800],
    onPrimary: p.white,
    subtle: p.neutral[100],
    onSubtle: p.neutral[900],
    accent: p.neutral[600],
    onAccent: p.white,
  },
  surface: {
    canvas: p.neutral[50],
    default: p.white,
    raised: p.white,
    sunken: p.neutral[100],
    inverse: p.neutral[900],
    overlay: 'rgba(15,15,14,0.48)',
  },
  text: {
    primary: p.neutral[900],
    secondary: p.neutral[600],
    tertiary: p.neutral[500],
    disabled: p.neutral[400],
    inverse: p.white,
    link: p.neutral[900],
  },
  border: { subtle: p.neutral[200], default: p.neutral[300], strong: p.neutral[700], focus: p.neutral[900] },
  icon: { primary: p.neutral[800], secondary: p.neutral[500], inverse: p.white },
  status: {
    success: { fg: p.neutral[800], bg: p.neutral[100], border: p.neutral[400], solid: p.neutral[700], onSolid: p.white },
    warning: { fg: p.amber[700], bg: p.amber[50], border: p.amber[300], solid: p.amber[600], onSolid: p.white },
    danger: { fg: p.red[700], bg: p.red[50], border: p.red[300], solid: p.red[600], onSolid: p.white },
    info: { fg: p.neutral[800], bg: p.neutral[100], border: p.neutral[300], solid: p.neutral[700], onSolid: p.white },
  },
  ai: { fg: p.neutral[800], bg: p.neutral[100], border: p.neutral[400] },
  chart: { before: p.neutral[300], after: p.neutral[800], trend: p.neutral[700], grid: p.neutral[200] },
  heat: { none: p.neutral[100], low: p.neutral[300], mid: p.neutral[500], high: p.neutral[800] },
  wire: {
    placeholder: p.neutral[100],
    placeholderStroke: p.neutral[300],
    annotation: '#FFF6C7',
    annotationBorder: '#E8C94A',
    onAnnotation: '#4A3B00',
  },
  gradient: { top: p.neutral[100], mid: p.neutral[50], bottom: p.neutral[50] },
  glass: { bg: 'rgba(255,255,255,0.8)', border: p.neutral[200], strong: p.white },
  orb: { from: p.neutral[500], to: p.neutral[800], core: p.neutral[900], glow: 'rgba(0,0,0,0.12)' },
  dock: { bg: p.white, border: p.neutral[200], item: p.neutral[100], activeBg: p.neutral[900], activeFg: p.white },
};

/** Brand = UI จริงตาม Figma (teal + gray) */
export const brandColors: ColorTokens = {
  brand: {
    primary: p.teal[600],
    primaryHover: p.teal[700],
    onPrimary: p.white,
    subtle: p.teal[50],
    onSubtle: p.teal[700],
    accent: p.turmeric[400],
    onAccent: p.turmeric[900],
  },
  surface: {
    canvas: p.gray[50],
    default: p.white,
    raised: p.white,
    sunken: p.gray[100],
    inverse: p.gray[900],
    overlay: 'rgba(17,24,39,0.48)',
  },
  text: {
    primary: p.gray[900],
    secondary: p.gray[600],
    tertiary: p.gray[400],
    disabled: p.gray[300],
    inverse: p.white,
    link: p.teal[700],
  },
  border: { subtle: p.gray[200], default: p.gray[300], strong: p.gray[600], focus: p.teal[600] },
  icon: { primary: p.gray[600], secondary: p.gray[400], inverse: p.white },
  status: {
    success: { fg: p.green[700], bg: p.green[50], border: p.green[300], solid: p.green[600], onSolid: p.white },
    warning: { fg: p.amber[700], bg: p.amber[50], border: p.amber[300], solid: p.amber[500], onSolid: p.white },
    danger: { fg: p.red[700], bg: p.red[50], border: p.red[300], solid: p.red[600], onSolid: p.white },
    info: { fg: p.blue[700], bg: p.blue[50], border: p.blue[300], solid: p.blue[600], onSolid: p.white },
  },
  ai: { fg: p.violet[700], bg: p.violet[50], border: p.violet[300] },
  chart: { before: p.gray[300], after: p.teal[600], trend: p.teal[600], grid: p.gray[200] },
  heat: { none: p.gray[100], low: p.pain.mid, mid: p.amber[500], high: p.pain.high },
  wire: {
    placeholder: p.gray[100],
    placeholderStroke: p.gray[300],
    annotation: '#FFF6C7',
    annotationBorder: '#E8C94A',
    onAnnotation: '#4A3B00',
  },
  gradient: { top: '#DDF3EE', mid: '#EEF8F6', bottom: p.gray[50] },
  // การ์ดในแชทซ้อนหน้าหุ่น 3D → ทึบพอไม่ให้สีผิวหุ่นทะลุเป็นแผ่นชมพู
  glass: { bg: 'rgba(255,255,255,0.94)', border: 'rgba(255,255,255,0.9)', strong: 'rgba(255,255,255,0.97)' },
  orb: { from: '#5EEAD4', to: p.violet[500], core: '#1E1B4B', glow: 'rgba(110,75,209,0.28)' },
  dock: { bg: 'rgba(255,255,255,0.92)', border: p.gray[200], item: p.gray[100], activeBg: p.teal[600], activeFg: p.white },
};

export type ThemeName = 'wireframe' | 'brand';
export const themes: Record<ThemeName, ColorTokens> = { wireframe: wireframeColors, brand: brandColors };
