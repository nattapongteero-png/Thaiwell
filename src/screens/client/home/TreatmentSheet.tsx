import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { BottomSheet, Icon, StretchDemo, Text, painColor, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';
import { type TreatmentCase } from '../../../data/homeFeed';
import { TreatmentDetailBody, VisitTabs } from './TreatmentDetailBody';
import { SYMPTOM_GROUPS } from '../../../data/thaiMassageKnowledge';
import { STRETCH_MOTION } from '../../../data/stretchMotion';

/**
 * รายละเอียดการรักษา (bottom sheet จากแชท) — แทนการพาไปหน้ารายการประวัติ
 * สรุป (ดีขึ้นกี่ % · คอร์ส) → กราฟปวดก่อน/หลังทุกครั้ง → รายครั้ง → บริเวณที่รักษา · ผู้ให้บริการ · นัดถัดไป → ดูแลตัวเอง
 */
export function TreatmentSheet({ tc, visible, onClose, initialVisit = null }: { tc: TreatmentCase | null; visible: boolean; onClose: () => void; /** เปิดที่แท็บครั้งนั้น (การ์ดผลครั้งที่ N) · null = ภาพรวม (การ์ดแผนการรักษา) */ initialVisit?: number | null }) {
  const [visit, setVisit] = React.useState<number | null>(initialVisit);
  React.useEffect(() => {
    if (visible) setVisit(initialVisit);
  }, [visible, tc?.id, initialVisit]);
  if (!tc) return null;
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      // หัวข้อบอกว่าเป็นหน้าอะไร · ชื่อเรื่องเป็นบรรทัดรอง
      title="แผนและผลการรักษา"
      subtitle={tc.short}
      heightRatio={0.9}
      // แถบเลือกครั้งค้างอยู่ใต้หัว (ไม่เลื่อนไปกับเนื้อหา)
      header={<VisitTabs count={tc.visits.length} dates={tc.visits.map((v) => v.date)} value={visit} onChange={setVisit} />}
    >
      <TreatmentDetailBody tc={tc} visit={visit} />
    </BottomSheet>
  );
}

/** ท่ายืด (bottom sheet จากแชท) — ภาพท่า + ขั้นตอน · ไม่ออกจากแชท */
export function StretchSheet({ groupId, visible, onClose }: { groupId: string | null; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const group = SYMPTOM_GROUPS.find((g) => g.id === groupId);
  if (!group) return null;
  const motion = STRETCH_MOTION[group.stretch.name];
  return (
    <BottomSheet visible={visible} onClose={onClose} title={group.stretch.name.replace(' 7 ท่า', '')} subtitle={group.short} heightRatio={0.88}>
      {motion ? (
        <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border.subtle }}>
          <StretchDemo motion={motion} steps={group.stretch.steps} height={280} />
        </View>
      ) : null}
      <View style={{ gap: space[3], padding: space[4], borderRadius: 20, backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
        <Text variant="bodyXs" tone="secondary">
          ขั้นตอน
        </Text>
        {group.stretch.steps.map((st, i) => (
          <View key={st} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand.subtle }}>
              <Text variant="labelSm" color={colors.brand.primary}>
                {i + 1}
              </Text>
            </View>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {st}
            </Text>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}
