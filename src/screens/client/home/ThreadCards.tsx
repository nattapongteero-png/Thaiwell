import React from 'react';
import { callClinic } from '../PlacesScreen';
import { Platform, Pressable, View } from 'react-native';
import {
  Badge,
  ChipSection,
  ElementSummary,
  GlassCard,
  HStack,
  Icon,
  ReplyChips,
  SafetyTag,
  Text,
  VStack,
  radius,
  space,
  typeScale,
  useTheme,
} from '../../../design-system';
import { ELEMENT_INFO, dominantElement } from '../../../data/thaiMassageKnowledge';
import type { InsightSource, ThreadCard } from '../../../data/homeFeed';
import { useJourney } from '../../../state/JourneyContext';
import { useNav } from '../../../navigation/types';

/**
 * ฟอนต์ IBM Plex Sans Thai วางตัวอักษรในบรรทัดต่างกันแต่ละแพลตฟอร์ม (วัดจากภาพหน้าจอ เทียบกึ่งกลางไอคอน 14px)
 * iOS สูงไป ~2pt · Android สูงไป ~0.8dp · เว็บต่ำไป ~0.6px → ขยับให้ตรงกลางไอคอน
 */
const CAPTION_NUDGE = Platform.select({ ios: 2, android: 0.8, default: -0.6 });

/** ป้ายบอกที่มาของข้อมูล — โปร่งใสว่าได้จาก AI, กฎ หรือผู้ประกอบวิชาชีพ */
export function SourceTag({ source, confirmedBy }: { source?: InsightSource; confirmedBy?: string }) {
  const { colors } = useTheme();
  if (!source) return null;
  const icon = source === 'ผู้ให้บริการ' ? 'user-check' : source === 'Safety Rule Engine' ? 'shield' : source === 'Knowledge Hub' ? 'book-open' : 'cpu';
  return (
    <HStack gap={1}>
      <Icon name={icon} size="xs" color={colors.text.tertiary} />
      <Text variant="caption" tone="tertiary" style={{ transform: [{ translateY: CAPTION_NUDGE }] }}>
        {source}
        {confirmedBy ? ` · ยืนยันโดย ${confirmedBy}` : ''}
      </Text>
    </HStack>
  );
}

/** ปุ่มแคปซูล — dark = action หลัก, light = action รอง */
export function PillButton({ label, onPress, tone = 'dark', icon }: { label: string; onPress?: () => void; tone?: 'dark' | 'light'; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  const { colors } = useTheme();
  const dark = tone === 'dark';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: space[5],
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        alignSelf: 'flex-start',
        backgroundColor: dark ? colors.text.primary : colors.glass.strong,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {icon ? <Icon name={icon} size="sm" color={dark ? colors.text.inverse : colors.text.primary} /> : null}
      <Text variant="labelMd" color={dark ? colors.text.inverse : colors.text.primary}>
        {label}
      </Text>
    </Pressable>
  );
}

function Tag({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: space[2], paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.brand.subtle }}>
      <Text variant="labelSm" color={colors.brand.onSubtle}>
        {label}
      </Text>
    </View>
  );
}

function BigNumber({ value, suffix, label }: { value: string | number; suffix?: string; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <Text variant="displayMd">
        {value}
        {suffix ? (
          <Text variant="titleXs" tone="secondary">
            {suffix}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

export function ThreadCardView({
  card,
  onEditAssessment,
  onTalkMore,
  onPlan,
  onBook,
  onSafety,
  onRedFlag,
  onOutcome,
}: {
  card: ThreadCard;
  /** รายละเอียดผลตรวจความปลอดภัย / คำแนะนำเมื่อไม่ควรนวด / ผลการรักษา → bottom sheet ในแชท (ไม่ออกจากแชท) */
  onSafety?: (card: Extract<ThreadCard, { type: 'safety' }>) => void;
  onRedFlag?: () => void;
  onOutcome?: () => void;
  /** แก้ผลประเมินในแชทนี้ */
  onEditAssessment?: () => void;
  /** คุยต่อกับ AI ในแชทนี้ */
  onTalkMore?: () => void;
  /** ให้ AI วางแผนการนวดจากข้อมูลแรกรับ + คลังความรู้ */
  onPlan?: () => void;
  /** จองกับ AI ในแชท (ไม่มี = ไปหน้าจองเอง) */
  onBook?: () => void;
}) {
  const { colors } = useTheme();
  const nav = useNav();
  const { elements, cases, drafts } = useJourney();
  const [answer, setAnswer] = React.useState(card.type === 'followup' ? card.answer : undefined);

  switch (card.type) {
    case 'outcome': {
      const pct = (v: number) => `${(v / 10) * 100}%` as const;
      return (
        <GlassCard onPress={onOutcome ?? (() => nav.navigate('SessionResult'))}>
          <HStack justify="space-between" align="flex-end">
            <BigNumber label="ก่อนนวด" value={card.before} suffix="/10" />
            {/* กล่องสูงเท่าบรรทัดตัวเลข → ลูกศรอยู่กึ่งกลางระดับเดียวกับ 6/10 และ 3/10 */}
            <View style={{ height: typeScale.displayMd.lineHeight, justifyContent: 'center' }}>
              <Icon name="arrow-right" color={colors.text.tertiary} />
            </View>
            <BigNumber label="หลังนวด" value={card.after} suffix="/10" />
            <Badge label={`ดีขึ้น ${card.before - card.after}`} tone="success" icon="trending-down" />
          </HStack>
          <View style={{ height: 10, borderRadius: radius.full, backgroundColor: colors.surface.sunken, justifyContent: 'center' }}>
            <View style={{ position: 'absolute', left: 0, width: pct(card.before), height: 10, borderRadius: radius.full, backgroundColor: colors.chart.before }} />
            <View style={{ position: 'absolute', left: 0, width: pct(card.after), height: 10, borderRadius: radius.full, backgroundColor: colors.brand.primary }} />
            <View style={{ position: 'absolute', left: pct(card.after), marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.surface.default, borderWidth: 5, borderColor: colors.brand.primary }} />
          </View>
          <Text variant="bodyXs" tone="secondary">
            {card.plan} · {card.date}
          </Text>
        </GlassCard>
      );
    }
    case 'followup':
      return (
        <GlassCard>
          <Text variant="titleSm">{card.question}</Text>
          <ReplyChips options={card.options} selected={answer} onPick={setAnswer} />
          {answer === 'แย่ลง' ? (
            <Text variant="bodyXs" color={colors.status.danger.fg}>
              ผู้ช่วยจะถามอาการเพิ่ม และแนะนำให้พบผู้ประกอบวิชาชีพหากจำเป็น
            </Text>
          ) : null}
        </GlassCard>
      );
    case 'screening':
      return (
        <GlassCard strong>
          {/* ไม่ต้องติดป้าย "สรุปโดย AI" — การ์ดอยู่ในข้อความของ AI อยู่แล้ว */}
          <Text variant="titleMd">{card.complaint}</Text>
          <HStack gap={6}>
            <BigNumber label="ความปวด" value={card.pain} suffix="/10" />
            <BigNumber label="เป็นมา" value={card.duration} />
          </HStack>
          <VStack gap={1}>
            <Text variant="caption" tone="secondary">
              ตำแหน่ง
            </Text>
            <HStack gap={1} wrap>
              {card.areas.map((a) => (
                <Tag key={a} label={a} />
              ))}
            </HStack>
          </VStack>
          <Text variant="bodyXs" tone="secondary">
            ปัจจัย: {card.triggers.join(', ')} · อาการร่วม: {card.related.join(', ')}
          </Text>
          <HStack gap={2}>
            {/* อยู่ในแชทอยู่แล้ว → แก้/คุยต่อในแชทนี้ ไม่เปิดหน้าใหม่ */}
            {onEditAssessment ? <PillButton label="แก้ไข" tone="light" icon="edit-2" onPress={onEditAssessment} /> : null}
            {onTalkMore ? <PillButton label="คุยเพิ่ม" tone="light" icon="message-circle" onPress={onTalkMore} /> : null}
          </HStack>
        </GlassCard>
      );
    case 'safety':
      return (
        <GlassCard>
          <HStack justify="space-between">
            <Text variant="titleSm">ผลตรวจความปลอดภัย</Text>
            <SafetyTag level={card.level} solid />
          </HStack>
          {card.items.map((it) => (
            <View key={it.id} style={{ gap: space[1] }}>
              <HStack gap={3} align="flex-start">
                <Badge label={it.id} tone={card.level === 'red' ? 'danger' : 'warning'} />
                <Text variant="bodyMd" style={{ flex: 1 }}>
                  {it.title}
                </Text>
              </HStack>
              {/* บรรทัดรอง = ข้อมูลที่ผู้ใช้ให้ · ซ้ำกับหัวข้อ = ไม่แสดง */}
              {it.evidence && it.evidence !== it.title ? (
                <Text variant="bodyXs" tone="secondary">
                  {it.evidence}
                </Text>
              ) : null}
            </View>
          ))}
          <PillButton label="ดูรายละเอียด" tone="light" onPress={onSafety ? () => onSafety(card) : () => nav.navigate('PreSummary')} />
        </GlassCard>
      );
    case 'element': {
      const top = dominantElement(elements);
      return (
        <GlassCard onPress={() => nav.navigate('ElementQuiz')}>
          <ElementSummary percent={elements[top]} name={ELEMENT_INFO[top].label} advice={ELEMENT_INFO[top].advice} />
          {ELEMENT_INFO[top].foods ? (
            <Text variant="bodyXs" tone="secondary">
              แนะนำ: {ELEMENT_INFO[top].foods}
            </Text>
          ) : null}
        </GlassCard>
      );
    }
    case 'plan':
      return (
        <GlassCard strong>
          <HStack justify="space-between" align="flex-start">
            <Text variant="titleMd" style={{ flex: 1 }}>
              {card.title}
            </Text>
            {card.approved ? <Badge label="อนุมัติแล้ว" tone="success" icon="check" /> : <Badge label="รอยืนยัน" tone="warning" />}
          </HStack>
          <VStack gap={1}>
            {card.adjustments.map((a) => (
              <HStack key={a} gap={2} align="flex-start">
                <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
                <Text variant="bodyXs" style={{ flex: 1 }}>
                  {a}
                </Text>
              </HStack>
            ))}
          </VStack>
          <HStack gap={1} wrap>
            {card.points.map((p) => (
              <Tag key={p} label={p} />
            ))}
          </HStack>
        </GlassCard>
      );
    case 'appointment': {
      // สถานะล่าสุดของนัดนี้ (การ์ดในแชทเป็นภาพตอนตอบ → เช็กอิน/ได้คิวแล้วต้องเปลี่ยนตาม)
      const live = card.caseId ? cases.find((c) => c.id === card.caseId)?.appointment : card.draftId ? drafts.find((d) => d.id === card.draftId)?.booking : undefined;
      const queue = live?.queue ?? card.queue;
      const stage = live?.stage;
      const isToday = !card.date || card.date === 'วันนี้';
      const target = { caseId: card.caseId, draftId: card.draftId };
      return (
        <GlassCard strong>
          <HStack justify="space-between" align="flex-end">
            <BigNumber label={card.date ?? 'วันนี้'} value={card.time} />
            {queue ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="caption" tone="secondary">
                  {stage === 'in_service' ? 'กำลังรับบริการ' : stage === 'called' ? 'ถึงคิวแล้ว' : 'คิว'}
                </Text>
                <Text variant="displayMd" color={colors.brand.primary}>
                  {queue}
                </Text>
              </View>
            ) : null}
          </HStack>
          <Text variant="bodyXs" tone="secondary">
            {[card.place, card.therapist, !queue && card.waitMin ? `อีก ${card.waitMin} นาที` : ''].filter(Boolean).join(' · ')}
          </Text>
          {card.service ? (
            <HStack gap={1} align="center">
              {card.warn ? <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} /> : null}
              <Text variant="bodyXs" color={card.warn ? colors.status.warning.fg : colors.text.secondary}>
                {card.service}
              </Text>
            </HStack>
          ) : null}
          <HStack gap={2}>
            {/* วันนัด: เช็กอิน → ดูคิว / ถึงคิวแล้ว → กำลังรับบริการ (ไม่มีปุ่ม) */}
            {queue ? (
              stage === 'in_service' ? null : (
                <PillButton label={stage === 'called' ? 'ถึงคิวแล้ว' : 'ดูคิว'} icon={stage === 'called' ? 'bell' : 'users'} onPress={() => nav.navigate('AppointmentDetail', target)} />
              )
            ) : isToday ? (
              <PillButton label="เช็กอิน" icon="maximize" onPress={() => nav.navigate('CheckIn', target)} />
            ) : null}
            {/* นัดของการรักษา หรือเช็กอินแล้ว: ติดต่อคลินิก · นัดที่จองเองในแอป (ยังไม่เช็กอิน): เลื่อนเองได้ */}
            {card.caseId || queue ? (
              <PillButton label="ติดต่อคลินิก" icon="phone" tone="light" onPress={() => callClinic(card.place)} />
            ) : (
              <PillButton label="เลื่อนนัด" tone="light" onPress={() => nav.navigate('Booking', target)} />
            )}
          </HStack>
        </GlassCard>
      );
    }
    case 'guideline':
      return (
        <GlassCard strong>
          <View style={{ gap: 2 }}>
            <Text variant="titleSm">แนวทางการรักษา & จุดกดบำบัด</Text>
            {card.condition ? (
              <Text variant="bodyXs" tone="secondary">
                {card.condition}
              </Text>
            ) : null}
          </View>
          {/* หลายบริเวณ: บริเวณหลักก่อน แล้วบริเวณรอง (ชื่อโรคของแต่ละบริเวณ) */}
          {card.areas && card.areas.length > 1 ? (
            <VStack gap={1}>
              {card.areas.map((a, i) => (
                <Text key={a.symptom} variant="bodyXs" tone={i ? 'secondary' : 'primary'}>
                  {i ? '' : 'หลัก · '}
                  {a.region ?? a.symptom} — {a.condition}
                </Text>
              ))}
            </VStack>
          ) : null}
          <VStack gap={1}>
            {card.methods.map((m) => (
              <HStack key={m} gap={2} align="flex-start">
                <Icon name="check-circle" size="xs" color={colors.brand.primary} />
                <Text variant="bodyXs" style={{ flex: 1 }}>
                  {m}
                </Text>
              </HStack>
            ))}
          </VStack>
          {card.points.length ? (
            <ChipSection title="จุดกดบำบัด (แสดงบนหุ่น)" options={card.points} value={[]} dot />
          ) : (
            // ตำราไม่ได้ระบุจุดสำหรับบริเวณนี้ → ไม่แต่งจุดขึ้นเอง
            <Text variant="bodyXs" tone="secondary">
              แพทย์แผนไทยเลือกจุดกดให้หน้างาน
            </Text>
          )}
          {card.caution ? (
            <HStack gap={2} align="flex-start">
              <Icon name="alert-triangle" size="xs" color={colors.status.warning.fg} />
              <Text variant="bodyXs" style={{ flex: 1 }}>
                {card.caution}
              </Text>
            </HStack>
          ) : null}
          <HStack gap={2} style={{ flexWrap: 'wrap' }}>
            {card.booked ? null : <PillButton label="จองนัดตามแนวทางนี้" icon="calendar" onPress={onBook ?? (() => nav.navigate('Booking'))} />}
            {onPlan ? <PillButton label="ขอแผนการนวด" tone="light" icon="list" onPress={onPlan} /> : null}
          </HStack>
        </GlassCard>
      );
    case 'book':
      // มีข้อห้ามนวด → คำแนะนำพบแพทย์ (ไม่เสนอจองนวด)
      return (
        <GlassCard strong>
          <HStack gap={2} align="flex-start">
            <Icon name="alert-triangle" size="sm" color={colors.status.danger.fg} />
            <Text variant="bodyXs" style={{ flex: 1 }}>
              ยังไม่ควรนวดจนกว่าแพทย์จะตรวจ
            </Text>
          </HStack>
          <PillButton label="ดูคำแนะนำ" icon="arrow-right" onPress={onRedFlag ?? (() => nav.navigate('RedFlag'))} />
        </GlassCard>
      );
    case 'selfcare':
      return (
        <GlassCard>
          <HStack justify="space-between">
            <View style={{ gap: 2 }}>
              <Text variant="titleSm">{card.name}</Text>
              <Text variant="bodyXs" tone="secondary">
                {card.dosage}
              </Text>
            </View>
            <Badge label={`ต่อเนื่อง ${card.streak} วัน`} tone="brand" icon="zap" />
          </HStack>
          <PillButton label="เริ่มเลย" icon="play" onPress={() => nav.navigate('SelfCare')} />
        </GlassCard>
      );
  }
}
