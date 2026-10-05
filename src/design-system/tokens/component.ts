/**
 * TIER 3 — COMPONENT TOKENS
 * ------------------------------------------------------------------
 * ค่าที่ผูกกับ component เฉพาะ (อ้าง primitive/semantic เท่านั้น)
 * ทีม UI ปรับ look ของ component ได้ที่นี่ที่เดียว โดยไม่ต้องแก้โค้ด component
 */
import { radius, space } from './primitives';
import { sizing } from './layout';
import type { TypeVariant } from './typography';

export const componentTokens = {
  button: {
    height: { sm: sizing.control.sm, md: sizing.control.md, lg: sizing.control.lg },
    paddingX: { sm: space[3], md: space[4], lg: space[6] },
    radius: radius.full,
    gap: space[2],
    label: { sm: 'labelMd', md: 'labelLg', lg: 'labelLg' } as Record<'sm' | 'md' | 'lg', TypeVariant>,
  },
  card: { radius: radius.lg, padding: space[4], gap: space[3] },
  chip: { height: 36, paddingX: space[3], radius: radius.full, gap: space[1] },
  /** Figma: symptom-chips (padding 8, text 11, gap 6) — paddingY ชดเชย line-height ของฟอนต์ไทย (Figma ใช้ text-box-trim) */
  chipSm: { padding: space[2], paddingY: 5, radius: radius.full, gap: space[1], groupGap: 6, dot: 6 },
  /** Figma: vas-card */
  /** Figma text-stack: การ์ดขาวโปร่งบนหน้าแรก */
  statCard: { width: 160, bg: 'rgba(255,255,255,0.9)', border: '#FFFFFF' },
  /** พื้นข้อความแชทฝั่ง AI: แก้วฝ้า (เห็นหุ่นด้านหลังจาง ๆ) · เว็บเบลอจริง · native ยังไม่มีไลบรารีเบลอ → ทึบขึ้นเล็กน้อยแทน */
  aiBubble: { bg: 'rgba(255,255,255,0.55)', bgNoBlur: 'rgba(255,255,255,0.78)', border: 'rgba(255,255,255,0.85)', blur: 16 },
  painCard: { width: 203, padding: space[3], radius: radius.lg, trackHeight: 8, thumb: 18, pill: 64, chartHeight: 80, chartLift: 48,
    shadow: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 1 } },
  /** Figma: element-donut */
  elementRing: { size: 48, border: 4 },
  /** pill ธาตุใต้ชื่อ — สีตามธาตุ (ไฟ = ส้มแดงอุ่น · ลม = ฟ้าเทา · น้ำ = น้ำเงินอมเขียว · ดิน = น้ำตาลดิน) */
  elementTag: {
    height: 26,
    ไฟ: { bg: '#FDE6DA', fg: '#B23E14' },
    ลม: { bg: '#E5ECF5', fg: '#3D5A80' },
    น้ำ: { bg: '#DDF0F3', fg: '#16697A' },
    ดิน: { bg: '#F1E8DC', fg: '#7A5530' },
  },
  /** Figma: AI composer (sparkle button + input) */
  composer: { button: 64, height: 64, radius: radius.lg, fadeHeight: 104 },
  /** Figma: bottom-nav */
  tabBar: { itemWidth: 75, icon: 22, gap: space[1], paddingTop: 10, paddingBottom: space[2] },
  /** หุ่น 3D — กรอบ 232×583 ตามภาพ body ใน Figma · cameraZ ให้หุ่นสูง 2 หน่วยราว 91% ของกรอบ เหลือขอบให้เท้าไม่ถูกตัด (fov 28° → 2 / (2·z·tan14°)) */
  body3d: { width: 232, height: 583, pinRadius: 0.035, fov: 28, cameraZ: 4.4 },
  /** Floating capsule tab bar */
  /** dock ลอย: tab menu + ส่วนเสริม (ช่องแชท AI) บน surface เดียว · marginBottom เว้นเพิ่มจาก safe area */
  /** ThaiWell back-office dock: ปุ่ม 44 · padding 8 · ช่องห่าง 8 · กว้างตามเนื้อหา (กึ่งกลางจอ) */
  dock: { height: 60, radius: radius.full, surfaceRadius: 28, padding: 8, gap: 8, item: 44, marginX: space[5], marginBottom: space[3], blur: 32 },
  /** ลูกแก้ว AI */
  orb: { sm: 32, md: 44, lg: 120, hero: 184 },
  /** LatticeLoader — สถานะ AI กำลังคิด (React Bits) */
  lattice: { cellSize: 6, gap: 2, fontSize: 13, step: 90, idleOpacity: 0.15 },
  /** หน้าคุยด้วยเสียง (ref: AI Receptionist) */
  voice: {
    cta: 64,
    ctaRadius: radius.full,
    /** ปุ่ม CTA ม่วง (ref: AI Receptionist "Call Now"): ม่วงเข้มซ้าย → ม่วงสว่างขวา + แสงชมพูม่วงเรืองจากขอบล่างกลางปุ่ม */
    ctaGradient: { from: '#5B2FD6', mid: '#7445EC', to: '#8F55F0', glow: '#E7C2FF', shadow: '#7B45EE' }, actionBtn: 64, actionGroupPadding: space[2], captionMinHeight: 96 },
  /** Chat composer แบบแก้ว */
  composerV2: { height: 56, radius: radius.full, gap: space[2] },
  /** Figma: header avatar / bell */
  homeHeader: { avatar: 44, bell: 40, bellIcon: 20 },
  input: { height: sizing.control.md, radius: radius.md, paddingX: space[4] },
  listItem: { minHeight: 56, paddingX: space[4], paddingY: space[3], gap: space[3] },
  badge: { height: 24, paddingX: space[2], radius: radius.full },
  banner: { radius: radius.lg, padding: space[4], gap: space[3] },
  appBar: { height: sizing.appBar, paddingX: space[2] },
  sheet: { radius: radius.xl, padding: space[6] },
  chatBubble: { radius: radius.lg, padding: space[3], maxWidthRatio: 0.82 },
  scale: { cell: 44, gap: space[1] },
  stepper: { dot: 8, gap: space[1] },
} as const;
