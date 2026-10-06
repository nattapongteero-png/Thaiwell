# ThaiWell AI — Wireframe Prototype (React Native)

แอป Wireframe สำหรับ **ThaiWell AI: Intelligent Thai Wellness & Massage Care Platform**
(HealthFlow Technology · Thai Traditional Medicine Digital Health & AI Hackathon 2026)

> "รู้ข้อมูลก่อนดูแล · ปลอดภัยระหว่างบริการ · เห็นผลหลังบริการ"

## เริ่มใช้งาน

```bash
npm install
npm run web        # เปิดบนเบราว์เซอร์ (เร็วที่สุดสำหรับ review flow)
npm run ios        # / npm run android — ผ่าน Expo Go หรือ simulator
npm run typecheck
npm run tokens     # export design tokens → design-tokens/tokens.json (สำหรับ Figma)
```

Stack: Expo SDK 54 · React Native 0.81 · TypeScript · React Navigation 7 · react-native-svg · three.js + @react-three/fiber (expo-gl) · IBM Plex Sans Thai

### ลงเครื่องจริง (iPhone / iPad)

```bash
cp .env.example .env     # ใส่ค่า Supabase ของหลังบ้าน (ดู ThaiWellAI/src/sync/cloud.ts) — ไม่มีไฟล์นี้ แอปจะจำลองการยืนยันเอง
npm run ios:device       # pod install → xcodebuild Release (JS bundle ในตัว ไม่ต้องเปิด Metro) → ติดตั้งและเปิดบนเครื่องที่จับคู่ไว้
```

ต้องมี Xcode, เครื่องที่จับคู่แล้วและเปิด Developer Mode, และบัญชี Apple Development ของตัวเอง — สคริปต์ใช้ทีม/bundle id ของผู้บิวด์ (`TEAM=… BUNDLE_ID=… npm run ios:device`) กับสำเนาของ project file ชั่วคราว ไม่แก้ของใน repo · แอปที่เซ็นด้วยบัญชีฟรีใช้ได้ 7 วัน

### เชื่อมหลังบ้านคลินิก (ThaiWellAI)

| ที่ไหน | สะพาน | ไฟล์ |
|---|---|---|
| มือถือ (iOS/Android) | **cloud** — Supabase ตารางเดียวกับหลังบ้าน (`tw_patients` · `tw_appointments` · `tw_events`) ข้ามเครื่อง/ข้ามเครือข่ายได้ | `src/services/cloudBridge.ts` |
| เว็บ (GitHub Pages) | localStorage ของเบราว์เซอร์เดียวกัน (เปิดแอปกับหลังบ้านคนละแท็บ) · ตั้ง `EXPO_PUBLIC_CLOUD=1` ตอน export ถ้าจะให้เว็บใช้ cloud ด้วย | `src/services/clinicBridge.ts` |

ทั้งสองสะพานส่งเหตุการณ์ชุดเดียวกันเข้า `JourneyContext`: จอง → คลินิกยืนยัน/ปฏิเสธ → เช็กอิน (หน้า "เช็กอิน" ในวันนัด) → เลขคิว · เรียกคิว · เริ่มบริการ → ผลการรักษา (ชื่อโรค คะแนน คำแนะนำ) → บิล (จ่ายในแอปได้) / ใบเสร็จ → แผนการรักษา · ยกเลิกจากแอปแจ้งคลินิก

ทุกเหตุการณ์จากคลินิกเด้งเป็นแจ้งเตือนบนเครื่องด้วย (`src/services/notify.ts`, expo-notifications แบบ local) — เด้งได้ขณะแอปเปิดหรือเพิ่งพักเบื้องหลัง · แจ้งเตือนตอนปิดแอปสนิท (remote push) ต้องมีกุญแจ APNs จาก Apple Developer และตัวส่งฝั่ง server เพิ่ม

> ⚠️ ต้นแบบ: key แบบ publishable เปิดอ่าน/เขียนทุกตาราง ใช้ข้อมูลสมมติเท่านั้น

## ใช้งานแอป

แอปเปิดที่ **หน้าแรกแบบ AI Care Thread** (ดู [docs/HOME_AI_CONCEPT.md](docs/HOME_AI_CONCEPT.md)) และมี tab bar แคปซูลติดล่าง 4 เมนู: หน้าแรก · ประวัติ · จองบริการ · โปรไฟล์

| ต้องการดู | ทำอย่างไร |
|---|---|
| คุยกับผู้ช่วย AI / คัดกรองก่อนนวด | พิมพ์ในช่องแชทล่างหน้าแรก หรือแตะไมค์ / "เล่าอาการใหม่" (ครั้งแรกจะขอความยินยอมก่อน) |
| กรณีพบ Red Flag | ใน AI Interview ตอบคำถามความปลอดภัยว่า “มีชาเล็กน้อย” หรือ “มีไข้” |
| ฝั่งผู้ให้บริการ | โปรไฟล์ › โหมดผู้ให้บริการ |
| ประเมินหลังนวด / ผลลัพธ์ | แท็บประวัติ |
| ท่าดูแลตนเอง 7 กลุ่มอาการ | กระดิ่ง › ติดตามผล หรือหน้าผลลัพธ์ › เริ่มท่าดูแลตนเอง |

## โครงสร้างโปรเจกต์

```
assets/figma/               asset จาก Figma (SVG ใช้เป็น component ผ่าน react-native-svg-transformer)
assets/models/              หุ่น 3D ยืน er_patient_figure.glb จาก github.com/bms-uxui/bms-hosxp-plus (แสดงด้วย three.js / react-three-fiber)
knowledge hub/              เอกสารต้นทางองค์ความรู้นวดไทย
src/
├─ design-system/          ← Design System (ใช้ได้ทั้งแอป)
│  ├─ tokens/              primitives → semantic (themes) → component tokens, typography, layout/grid
│  ├─ theme/               ThemeProvider (ธีม brand = Figma, wireframe)
│  ├─ layout/              Screen, VStack/HStack, GridRow/Col, useGrid (responsive 4/8/12 col)
│  └─ components/          Button, Card, Chip, ScaleSelector, BodyMap, AI components, Charts ...
├─ services/
│  ├─ safetyEngine.ts      Rule Engine (deterministic, traceable) — RF-xx / CA-xx
│  └─ aiInterview.ts       NLP mock: ภาษาพูด → structured complaint + adaptive script
├─ data/                   thaiMassageKnowledge (สกัดจาก knowledge hub พร้อมเลขหน้า), homeContent, Laws of UX
├─ state/JourneyContext    ข้อมูลที่ไหลตลอด Journey + Audit log
├─ navigation/             Root stack + Client tabs + Provider tabs
└─ screens/  client/ provider/
design-tokens/tokens.json  W3C DTCG format (Tokens Studio / Figma Variables / Style Dictionary)
docs/                      DESIGN_SYSTEM.md · USER_FLOW.md · LAWS_OF_UX.md
```

## เอกสาร

- [docs/USER_FLOW.md](docs/USER_FLOW.md) — Flow ทั้งระบบ + Innovation ที่ใส่ในแต่ละจุด + Pain point → Solution
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — Token architecture, Color, Typography, Grid, Component inventory, กฎการใช้
- [docs/LAWS_OF_UX.md](docs/LAWS_OF_UX.md) — Laws of UX แต่ละข้อ ใช้ที่หน้าไหน อย่างไร

## ⚠️ ข้อจำกัด

- ข้อมูลผู้ป่วย, กฎความปลอดภัย (RF/CA), Knowledge Base และแหล่งอ้างอิงทั้งหมดเป็น **mock** เพื่อสาธิต UX
  ต้องให้แพทย์แผนไทย/ผู้เชี่ยวชาญตรวจสอบและรับรองก่อนใช้งานจริง
- AI Interview / Speech-to-text / RAG เป็นการจำลอง (keyword + setTimeout) — จุดเชื่อม LLM จริงระบุไว้ในคอมเมนต์ของ `services/`
