import React from 'react';
import { Linking, View } from 'react-native';
import { BottomSheet, Button, Icon, Panel, Text, TINT, useTheme } from '../../../design-system';
import { space } from '../../../design-system/tokens';
import { SHORT_CAUTION, type ThreadCard } from '../../../data/homeFeed';
import { procedureGates } from '../../../services/safetyEngine';
import { useJourney } from '../../../state/JourneyContext';

type SafetyCard = Extract<ThreadCard, { type: 'safety' }>;

/**
 * ผลตรวจความปลอดภัย (bottom sheet จากแชท) — ตอบ 3 คำถามของผู้ใช้ตามลำดับ
 * 1) วันนี้นวดได้ไหม (สรุปผลเดียว) → 2) พบอะไร จากข้อมูลไหน และผู้ให้บริการจะปรับอย่างไร → 3) ทำอะไรต่อ
 * ไม่ควรนวด → สิ่งที่ควรทำตอนนี้ + อาการที่ต้องโทร 1669 · ไม่แสดงแหล่งอ้างอิงในหน้า (ใช้ในเกณฑ์เท่านั้น)
 */
export function SafetySheet({
  card,
  reason,
  visible,
  onClose,
  onBook,
  onHospital,
}: {
  card: SafetyCard | null;
  /** เหตุที่ไม่ควรนวด (เช่น ผลประเมินอาการ) — มาจากปุ่ม "ดูคำแนะนำ" */
  reason?: string;
  visible: boolean;
  onClose: () => void;
  onBook?: () => void;
  onHospital: () => void;
}) {
  const { colors } = useTheme();
  const { safety, profile, lastAssess, log } = useJourney();
  const level = card?.level ?? (reason ? 'red' : safety.level);
  const items = card?.items ?? [];
  // สิ่งที่ผู้ให้บริการจะปรับ: ข้อความเต็มจากกฎ (โปรไฟล์) หรือข้อความสั้นของกฎ
  const actionOf = (id: string) => safety.hits.find((h) => h.ruleId === id)?.action ?? SHORT_CAUTION[id];
  // หัตถการเสริมที่ต้องงด (อบ/ประคบสมุนไพร) — แยกจากการนวด
  const gates = level === 'red' ? [] : procedureGates(profile).filter((g) => !g.allowed);
  const tone = level === 'red' ? colors.status.danger : level === 'amber' ? colors.status.warning : colors.status.success;
  const verdict =
    level === 'red'
      ? { icon: 'x-octagon' as const, title: 'วันนี้ยังไม่ควรนวด', sub: 'ควรให้แพทย์ตรวจก่อน แล้วค่อยกลับมานวด' }
      : level === 'amber'
        ? { icon: 'alert-triangle' as const, title: 'นวดได้ โดยปรับวิธีให้เหมาะ', sub: `พบ ${items.length || safety.hits.length} ข้อที่ผู้ให้บริการจะปรับให้` }
        : { icon: 'check-circle' as const, title: 'นวดได้ตามปกติ', sub: 'ไม่พบข้อห้ามจากข้อมูลที่ให้มา' };
  const used = [
    lastAssess ? `อาการ: ${lastAssess.symptoms.join(', ') || '-'} · ปวด ${lastAssess.pain}/10` : '',
    `โรคประจำตัว: ${profile.conditions.join(', ') || 'ไม่มี'}`,
    `ยาที่ใช้: ${profile.medications.join(', ') || 'ไม่มี'}`,
  ].filter(Boolean);
  const call1669 = () => {
    log('ผู้รับบริการ', 'โทรฉุกเฉิน 1669');
    Linking.openURL('tel:1669').catch(() => {});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="ผลตรวจความปลอดภัย"
      heightRatio={0.86}
      footer={
        level === 'red' ? (
          <View style={{ gap: space[2] }}>
            <Button label="หาโรงพยาบาลใกล้คุณ" iconLeft="map-pin" onPress={onHospital} />
            <Button label="โทร 1669 (ฉุกเฉิน)" variant="secondary" iconLeft="phone" onPress={call1669} />
          </View>
        ) : onBook ? (
          <Button label="จองนวด" iconLeft="calendar" onPress={onBook} />
        ) : null
      }
    >
      {/* 1) สรุปผลเดียว: นวดได้ไหม */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: 20, backgroundColor: tone.bg }}>
        <Icon name={verdict.icon} size="lg" color={tone.fg} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleMd" color={tone.fg}>
            {verdict.title}
          </Text>
          <Text variant="bodySm" color={tone.fg}>
            {verdict.sub}
          </Text>
        </View>
      </View>

      {/* ยังไม่ได้บอกโรคประจำตัว/ยา → บอกตรง ๆ ว่าผลยังไม่ครบ */}
      {profile.healthKnown === false ? (
        <Panel icon="info" tint={TINT.amber} title="ยังไม่มีข้อมูลโรคประจำตัวและยา">
          <Text variant="bodySm" tone="secondary">
            ผู้ให้บริการจะถามเพิ่มก่อนนวด
          </Text>
        </Panel>
      ) : null}

      {/* 2) พบอะไร · จากข้อมูลไหน · ผู้ให้บริการจะทำอย่างไร */}
      {reason || items.length ? (
        <Panel icon="search" tint={level === 'red' ? TINT.red : TINT.amber} title="สิ่งที่พบ">
          {reason ? (
            <Text variant="bodyMd" style={{ fontWeight: '600' }}>
              {reason}
            </Text>
          ) : null}
          {items.map((it) => {
            const act = level === 'red' ? undefined : actionOf(it.id);
            return (
              <View key={it.id} style={{ gap: 4 }}>
                <Text variant="bodyMd" style={{ fontWeight: '600' }}>
                  {it.title}
                </Text>
                {it.evidence && it.evidence !== it.title ? (
                  <Text variant="bodySm" tone="secondary">
                    {it.evidence}
                  </Text>
                ) : null}
                {act ? (
                  <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                    <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                    <Text variant="bodySm" style={{ flex: 1 }}>
                      ผู้ให้บริการจะ{act}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Panel>
      ) : null}

      {/* หัตถการเสริมที่ต้องงด */}
      {gates.length ? (
        <Panel icon="slash" tint={TINT.amber} title="ครั้งนี้งด">
          {gates.map((g) => (
            <Text key={g.procedure} variant="bodySm">
              {g.procedure} · เพราะ{g.reasons.join(', ')}
            </Text>
          ))}
        </Panel>
      ) : null}

      {/* 3) ไม่ควรนวด → สิ่งที่ทำได้ตอนนี้ + อาการฉุกเฉิน */}
      {level === 'red' ? (
        <>
          <Panel icon="list" tint={TINT.green} title="ควรทำอย่างไรต่อ">
            {['พบแพทย์ที่โรงพยาบาลหรือศูนย์สุขภาพใกล้บ้าน', 'บอกแพทย์ถึงอาการที่พบด้านบน', 'แพทย์ตรวจแล้ว กลับมาประเมินใหม่ในแอปได้'].map((t, i) => (
              <View key={t} style={{ flexDirection: 'row', gap: space[2], alignItems: 'flex-start' }}>
                <Text variant="labelSm" tone="secondary" style={{ width: 16 }}>
                  {i + 1}.
                </Text>
                <Text variant="bodySm" style={{ flex: 1 }}>
                  {t}
                </Text>
              </View>
            ))}
          </Panel>
          <Panel icon="phone" tint={TINT.red} title="โทร 1669 ทันทีถ้ามีอาการเหล่านี้">
            <Text variant="bodySm" tone="secondary">
              ชาหรืออ่อนแรงครึ่งซีก พูดไม่ชัด เจ็บแน่นหน้าอก ปวดศีรษะรุนแรงเฉียบพลัน
            </Text>
          </Panel>
        </>
      ) : null}

      {/* ข้อมูลที่ใช้ตรวจ — ให้รู้ว่าผลมาจากอะไร และแก้ได้ถ้าไม่ตรง */}
      <Panel icon="file-text" tint={TINT.slate} title="ข้อมูลที่ใช้ตรวจ">
        {used.map((u) => (
          <Text key={u} variant="bodySm" tone="secondary">
            {u}
          </Text>
        ))}
      </Panel>
    </BottomSheet>
  );
}
