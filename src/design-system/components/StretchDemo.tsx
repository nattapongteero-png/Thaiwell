import React from 'react';
import { View } from 'react-native';
import { LoadingImage } from './Skeleton';
import { componentTokens, radius, space } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import type { StretchMotion } from '../../data/stretchMotion';

/**
 * StretchDemo — ภาพสาธิตท่ายืดแบบวนซ้ำ (แนวเดียวกับ GIF ของ gymnerd / ExerciseDB)
 * - ภาพ = GIF ที่เรนเดอร์ล่วงหน้าจากหุ่น 3D มีโครงกระดูก (scripts/render-stretch-gifs.mjs) → แสดงได้ทุกที่ ไม่ต้องคำนวณ 3D บนมือถือ
 * - บนหุ่นระบายสีส่วนที่ได้ยืด (หลัก = แดง · เสริม = ส้ม) ชัดขึ้นตอนค้างท่า
 * - ป้ายส่วนที่ได้ยืดบนซ้าย ขอบสีขึ้นตอนค้างท่า (เวลาเดียวกับ GIF จาก keyframe ใน data/stretchMotion)
 */
const GIF: Record<string, number> = {
  'kae-kiat': require('../../../assets/stretch/kae-kiat.gif'),
  'chu-hat-wat-lang': require('../../../assets/stretch/chu-hat-wat-lang.gif'),
  'ying-thanu': require('../../../assets/stretch/ying-thanu.gif'),
  'uad-waen-phet': require('../../../assets/stretch/uad-waen-phet.gif'),
  'damrong-kai': require('../../../assets/stretch/damrong-kai.gif'),
  'kae-khao-khat': require('../../../assets/stretch/kae-khao-khat.gif'),
  'nuad-na': require('../../../assets/stretch/nuad-na.gif'),
};
/** สีเดียวกับที่ระบายบนหุ่น (scripts/render-stretch-gifs.mjs) */
const PRIMARY = '#D93A2B';
/** เวลาต่อเฟรมของ GIF (scripts/render-stretch-gifs.mjs FRAME_MS) → ความยาว 1 รอบ = จำนวนเฟรม × 80ms */
const FRAME_MS = 80;
const ASSIST = '#F08A24';

export const hasStretchDemo = (m?: StretchMotion) => !!m && !!GIF[m.id];
/** ภาพ GIF ของท่า (ใช้เป็นภาพปกในหน้ารวมท่า) */
export const stretchGif = (m?: StretchMotion) => (m ? GIF[m.id] : undefined);

export function StretchDemo({
  motion,
  steps,
  height = 320,
  flushTop,
}: {
  motion: StretchMotion;
  steps: string[];
  height?: number;
  /** วางชิดขอบบนของ Card (เต็มความกว้าง มุมบนโค้งเท่าการ์ด) */
  flushTop?: boolean;
}) {
  const { colors } = useTheme();
  // ช่วงเวลาของแต่ละท่า [เคลื่อน → ค้าง] ตรงกับเฟรมของ GIF
  const spans = React.useMemo(() => {
    let t = 0;
    return motion.keys.map((k) => {
      // ป้ายเปลี่ยนเมื่อท่าเคลื่อนไปแล้ว ~30% (ตรงกับที่ตาเห็นว่าเริ่มท่าใหม่ ไม่นำหน้าภาพ)
      const s = { switchAt: t + k.move * 0.3, moveEnd: t + k.move, end: t + k.move + k.hold, step: k.step, peak: !!k.peak };
      t = s.end;
      return s;
    });
  }, [motion]);
  // ความยาวรอบจริงของ GIF (ปัดขึ้นเป็นเฟรมเต็ม) — ใช้ค่าเดียวกันไม่ให้ป้ายเหลื่อมกับภาพทีละรอบ
  const total = Math.ceil(spans[spans.length - 1].end / FRAME_MS) * FRAME_MS;
  const [now, setNow] = React.useState<{ step?: number; peak: boolean }>({ peak: false });
  const start = React.useRef<number | null>(null);
  React.useEffect(() => {
    const id = setInterval(() => {
      if (start.current === null) return;
      const t = (Date.now() - start.current) % total;
      const i = Math.max(0, spans.findIndex((x) => t < x.end));
      const s = t < spans[i].switchAt ? spans[(i - 1 + spans.length) % spans.length] : spans[i];
      const peak = s.peak && t >= s.moveEnd;
      setNow((p) => (p.step === s.step && p.peak === peak ? p : { step: s.step, peak }));
    }, 100);
    return () => clearInterval(id);
  }, [spans, total]);

  return (
    <View>
      <View
        accessibilityRole="image"
        accessibilityLabel={`ภาพสาธิตท่า${now.step !== undefined ? ` ขั้นที่ ${now.step + 1} ${steps[now.step]}` : ''} ส่วนที่ได้ยืด ${motion.primary.label}${motion.assist ? ` และ ${motion.assist.label}` : ''}`}
        style={[
          { height, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface.sunken },
          // ชิดขอบบนการ์ด: ยื่นออกเท่า padding ของการ์ด · มุมบนโค้งเท่าการ์ด มุมล่างตรง (รับกับเนื้อหาด้านล่าง)
          flushTop
            ? {
                marginHorizontal: -componentTokens.card.padding,
                marginTop: -componentTokens.card.padding,
                borderRadius: 0,
                borderTopLeftRadius: componentTokens.card.radius,
                borderTopRightRadius: componentTokens.card.radius,
              }
            : null,
        ]}
      >
        {/* หุ่นกลางการ์ด */}
        <LoadingImage source={GIF[motion.id]} resizeMode="contain" silhouette={height * 0.62} onLoad={() => (start.current = Date.now())} style={{ width: '100%', height: '100%' }} />
        {/* บนซ้าย: ท่านี้ช่วยส่วนไหน (สีเดียวกับบนหุ่น) — แถวเดียว · ขั้นตอนดูจากรายการใต้ภาพ */}
        <View pointerEvents="none" style={{ position: 'absolute', left: space[3], right: space[3], top: space[3], flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          <AreaChip color={PRIMARY} label={motion.primary.label} />
          {motion.assist ? <AreaChip color={ASSIST} label={motion.assist.label} /> : null}
        </View>
      </View>
    </View>
  );
}

function AreaChip({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.9)' }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="labelSm">{label}</Text>
    </View>
  );
}
