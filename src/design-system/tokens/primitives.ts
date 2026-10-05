/**
 * TIER 1 — PRIMITIVE TOKENS (Global / Reference tokens)
 * ------------------------------------------------------------------
 * ค่าดิบทั้งหมดของระบบ ห้ามใช้ตรง ๆ ใน component
 * ให้อ้างผ่าน Semantic tokens (semantic.ts) เท่านั้น
 * แนวทางเดียวกับ Material 3 (ref palette), IBM Carbon, Salesforce Lightning
 *
 * สเกลสี 0–1000 (ยิ่งมากยิ่งเข้ม) — 500 คือค่าหลัก
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',

  /** Neutral — ใช้เป็นโทนหลักของ Wireframe และ surface/text ของ Brand */
  neutral: {
    0: '#FFFFFF',
    50: '#F7F7F6',
    100: '#EFEFED',
    200: '#E2E2DF',
    300: '#CACAC6',
    400: '#A3A39E',
    500: '#7A7A75',
    600: '#5C5C58',
    700: '#454542',
    800: '#2E2E2C',
    900: '#1C1C1B',
    1000: '#0F0F0E',
  },

  /** Herbal Green — สีแบรนด์หลัก (สมุนไพร / ความสงบ / สุขภาพ) อ้างอิงโทนจาก Concept Paper */
  herbal: {
    50: '#EAF4F1',
    100: '#CFE6DF',
    200: '#A3CFC2',
    300: '#72B3A2',
    400: '#489682',
    500: '#2C7A68',
    600: '#1F6354',
    700: '#184E43',
    800: '#123B33',
    900: '#0B2621',
  },

  /** Turmeric Gold — Accent (ขมิ้น / ลูกประคบ / ความอบอุ่นแบบไทย) */
  turmeric: {
    50: '#FDF6E7',
    100: '#FAE8BF',
    200: '#F5D48A',
    300: '#EFBD52',
    400: '#E4A42A',
    500: '#C98A14',
    600: '#A16D0E',
    700: '#7A520B',
    800: '#553908',
    900: '#332204',
  },

  /** Teal — สีแบรนด์ตาม Figma (ThaiWell UI) */
  teal: { 50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E', 800: '#115E59' },

  /** Gray — neutral ของ Figma (Tailwind gray scale) */
  gray: { 50: '#F9FAFB', 100: '#F3F4F6', 200: '#E5E7EB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827' },

  /** โทนผิวหุ่น 3D (อิงสีผิวในภาพร่างกายของ Figma) */
  /** model = สีผิวของหุ่น 3D (เข้มกว่า base เพราะแสง/tone mapping ทำให้สว่างขึ้น) */
  skin: { base: '#F2CDB4', shade: '#E0AE92', model: '#C98F6E' },
  /** กางเกงขาสั้นของหุ่น 3D (ระบายบนผิว) */
  garment: { base: '#3E5361' },

  /** Pain scale (VAS) gradient — Figma slider-track */
  pain: { low: '#22C55E', mid: '#EAB308', high: '#EF4444', thumb: '#62BF42' },

  /** Status palettes — ใช้กับระบบ Safety (Traffic-light) */
  red: { 50: '#FDECEC', 100: '#F9CFCF', 300: '#EE8A8A', 500: '#D63B3B', 600: '#B42828', 700: '#8C1D1D', 900: '#4A0E0E' },
  amber: { 50: '#FFF5E5', 100: '#FFE3B3', 300: '#FFBE4D', 500: '#E08A00', 600: '#B86F00', 700: '#8A5300', 900: '#462A00' },
  green: { 50: '#E9F7EE', 100: '#C7EBD3', 300: '#7CCB97', 500: '#2E9E57', 600: '#237D44', 700: '#1A5E33', 900: '#0C2E19' },
  blue: { 50: '#EAF2FD', 100: '#C9DDFA', 300: '#7EAEF1', 500: '#2F6FD6', 600: '#2358AD', 700: '#1B4384', 900: '#0D2142' },
  violet: { 50: '#F2EEFC', 100: '#DDD3F7', 300: '#A993E8', 500: '#6E4BD1', 600: '#5838AD', 700: '#432A84', 900: '#221542' },
} as const;

/** 4-pt base spacing scale (Material / Apple HIG / Atlassian ใช้ 4 หรือ 8pt grid) */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const borderWidth = {
  none: 0,
  hairline: 1,
  thick: 2,
  heavy: 4,
} as const;

export const opacity = {
  disabled: 0.38,
  pressed: 0.12,
  hover: 0.08,
  scrim: 0.48,
} as const;

/** Motion — Duration + Easing (อ้างอิง Material 3 motion) */
export const duration = {
  instant: 100,
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const easing = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  overlay: 1000,
  modal: 1100,
  toast: 1200,
} as const;
