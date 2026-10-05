# ThaiWell Design System v0.1

แนวทางอ้างอิง: Material Design 3 (token tiers, type scale, layout grid), Apple HIG (touch target, Dynamic Type),
IBM Carbon / Salesforce Lightning (semantic naming), W3C Design Tokens Community Group (DTCG JSON format)

## 1. Token architecture (3 tiers)

```
Primitive (ค่าดิบ)        palette.herbal[600] = #1F6354        ← ห้ามใช้ใน component
   ↓
Semantic (ตามหน้าที่)      colors.brand.primary                 ← component ใช้ชั้นนี้
   ↓                      (wireframe → neutral[900] / brand → herbal[600])
Component (เฉพาะชิ้น)      componentTokens.button.height.lg = 56
```

- Source of truth: `src/design-system/tokens/*.ts`
- Export ให้ Figma: `npm run tokens` → `design-tokens/tokens.json` (DTCG) → import ด้วย Tokens Studio หรือแปลงเป็น Figma Variables
- เพิ่มธีม (dark / high-contrast / kiosk) = เพิ่ม object ที่ implement `ColorTokens` แล้วใส่ใน `themes`

## 2. Color

| กลุ่ม semantic | ใช้กับ |
|---|---|
| `brand.*` | action หลัก, สถานะเลือก, ไฮไลต์แบรนด์ |
| `surface.*` | canvas (พื้นหลังหน้า), default/raised (การ์ด), sunken (พื้นลึก), inverse, overlay |
| `text.*` | primary / secondary / tertiary / disabled / inverse / link |
| `border.*` | subtle / default / strong / focus |
| `status.{success,warning,danger,info}` | **Safety traffic light** — แต่ละตัวมี fg / bg / border / solid / onSolid |
| `ai.*` | ทุก output ของ AI (ป้าย, quick reply, entity chip) — ให้แยกออกทันทีว่าเป็นข้อเสนอแนะ |
| `chart.*`, `heat.*` | Before/After, trend, ระดับอาการบน Body Map |
| `wire.*` | placeholder / UX annotation (ใช้เฉพาะ wireframe) |

Brand palette ตั้งต้น: **Herbal Green** (สมุนไพร/ความสงบ, อิงโทน Concept Paper) + **Turmeric Gold** (ขมิ้น/ลูกประคบ)

กฎ:
- คอนทราสต์ WCAG AA: ข้อความ ≥ 4.5:1, ข้อความใหญ่/ไอคอน ≥ 3:1
- ห้ามสื่อสถานะด้วยสีอย่างเดียว → สี + ไอคอน + ข้อความ (`SafetyTag`, `Banner`)
- `status.danger` ใช้เฉพาะ Red Flag / action ที่ย้อนกลับไม่ได้ (Von Restorff)

## 3. Typography — IBM Plex Sans Thai

| Token | Size/Line | Weight | ใช้กับ |
|---|---|---|---|
| displayLg / displayMd | 40/52 · 32/44 | Bold | ตัวเลขผลลัพธ์, คิว |
| headlineLg/Md/Sm | 28/40 · 24/36 · 20/30 | SemiBold | หัวหน้าจอ |
| titleLg/Md/Sm | 18/28 · 16/24 · 14/22 | SemiBold/Medium | หัวการ์ด, รายการ |
| bodyLg/Md/Sm | 17/28 · 15/24 · 13/20 | Regular | เนื้อหา (ขั้นต่ำ 15 สำหรับเนื้อหาหลัก) |
| labelLg/Md/Sm | 15/22 · 13/20 · 11/16 | SemiBold/Medium | ปุ่ม, chip, badge |
| overline | 11/16 +1 tracking | SemiBold | หัวหมวด (EN uppercase) |

- line-height ≥ 1.4× เพราะภาษาไทยมีสระบน/ล่าง + วรรณยุกต์ (ป้องกันตัวอักษรชนกัน)
- ใช้ `<Text variant="…">` เท่านั้น ห้ามกำหนด fontSize เอง
- Dynamic Type: `maxFontSizeMultiplier = 1.6`

## 4. Spacing, Radius, Elevation

- **4pt base**: 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 (`space[n]`)
- **Radius**: none 0 · xs 4 · sm 8 · md 12 (control) · lg 16 (card) · xl 24 (sheet) · full
- **Elevation 0–3**: 0 = flat, 1 = card, 2 = การ์ดเด่น/active journey, 3 = modal/sheet

## 5. Grid & Layout

| Breakpoint | Width | Columns | Margin | Gutter | Max content | อุปกรณ์ |
|---|---|---|---|---|---|---|
| compact | < 600 | 4 | 16 | 16 | 600 | มือถือผู้รับบริการ |
| medium | 600–1023 | 8 | 24 | 24 | 840 | Tablet ผู้ให้บริการ |
| expanded | ≥ 1024 | 12 | 32 | 24 | 1200 | KIOSK / Web dashboard |

```tsx
<GridRow>
  <Col span={{ compact: 4, medium: 5, expanded: 8 }}>…summary…</Col>
  <Col span={{ compact: 4, medium: 3, expanded: 4 }}>…body map…</Col>
</GridRow>
```

- `Screen` = container มาตรฐาน: grid margin, max width, safe area, **footer ติดล่างสำหรับ primary CTA (thumb zone)**
- `VStack` / `HStack` ใช้ `gap` จาก spacing token เท่านั้น
- Touch target ขั้นต่ำ **48pt**; ปุ่มหลัก 56pt

## 6. Component inventory

| หมวด | Components |
|---|---|
| Foundations | `Text`, `Icon` (Feather), `ThemeProvider`, `useGrid` |
| Layout | `Screen`, `VStack`, `HStack`, `Spacer`, `GridRow`, `Col` |
| Actions | `Button` (primary/secondary/tertiary/ghost/danger × sm/md/lg, loading, disabled), `IconButton` |
| Inputs | `TextField`, `Chip`, `ChipGroup`, `Checkbox`, `RadioGroup`, `Switch`, `SegmentedControl`, `ScaleSelector` (NRS 0–10), `FaceScale` (1–5) |
| Containers | `Card` (outlined/elevated/filled), `Divider`, `SectionHeader`, `KeyValue`, `Avatar`, `Placeholder` |
| Navigation | `AppBar`, `ListItem`, Bottom tabs |
| Feedback | `Badge`, `SafetyTag`, `Banner`, `ProgressBar`, `JourneyStepper`, `EmptyState` |
| AI | `AILabel`, `ChatBubble`, `TypingIndicator`, `EntityChip`, `SourceList`, `ReasonTrace`, `MatchMeter` |
| Domain | `BodyMap` (หน้า/หลัง, heat, region id), `HeatLegend` |
| Data viz | `StatDelta`, `BeforeAfterBars`, `TrendLine` |
| Wireframe only | `UXNote` (annotation), `Placeholder` |

ดูตัวอย่างทุกชิ้นแบบ live ได้ในแอป: Hub › **Design System**

## 7. กฎการเขียน component

1. ใช้ semantic token ผ่าน `useTheme().colors` — ไม่ hard-code สี/ขนาด
2. ทุก interactive element มี `accessibilityRole` + `accessibilityLabel` (IconButton บังคับ `label`)
3. 1 หน้าจอมี primary button ได้ 1 ปุ่ม
4. Output ของ AI ต้องมี `AILabel` และถ้าเป็นคำแนะนำต้องมี `SourceList` / `ReasonTrace`
5. ภาษา: เป็นกันเอง สุภาพ ไม่ใช้คำวินิจฉัย (“อาจเหมาะสม”, “ควรพบแพทย์” แทน “คุณเป็นโรค…”)
