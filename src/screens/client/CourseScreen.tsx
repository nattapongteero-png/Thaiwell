import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, BottomSheet, Icon, IconBox, InfoRow, Panel, ProgressBar, Screen, StatTile, TINT, Tag, Text, useTheme } from '../../design-system';
import { space } from '../../design-system/tokens';
import { useJourney, type LooseBooking } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { isoToLabel } from '../../services/clinicBridge';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
/** "2026-11-07" → "7 พ.ย. 2569" */
const thaiDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y ? `${d} ${MONTHS[m - 1]} ${y + 543}` : iso;
};
const STAGE: Record<string, string> = { checked_in: 'เช็กอินแล้ว', called: 'ถึงคิวแล้ว', in_service: 'กำลังรับบริการ' };

/**
 * คอร์สการรักษาของฉัน — คอร์สที่คลินิกเปิดให้ (ชื่อ จำนวนครั้ง ใช้ไป หมดอายุ) + นัดตามคอร์สที่คลินิกลงไว้ เรียงตามวัน
 * ข้อมูลมาจากระบบคลินิก: คลินิกเปิดคอร์ส / จัดตารางนัด → ขึ้นที่นี่ · นวดเสร็จ → จำนวนครั้งที่ใช้อัปเดตเอง
 */
export function CourseScreen() {
  const nav = useNav();
  return (
    <Screen header={<AppBar title="การรักษาของฉัน" onBack={() => nav.goBack()} />}>
      <CourseBody />
    </Screen>
  );
}

/** คอร์สการรักษาแบบ bottom sheet (การ์ดคอร์สในหน้าแรก = ดูข้อมูล → sheet) · แตะนัด = ปิด sheet แล้วไปหน้ารายละเอียดนัด */
export function CourseSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="คอร์สการรักษา" heightRatio={0.9}>
      <CourseBody onLeave={onClose} />
    </BottomSheet>
  );
}

/** เนื้อหาคอร์ส + นัด + ประวัติ (ใช้ทั้งหน้า "การรักษาของฉัน" และ sheet) · onLeave = ก่อนออกไปหน้าอื่น (ปิด sheet) */
export function CourseBody({ onLeave }: { onLeave?: () => void }) {
  const nav0 = useNav();
  const nav = { navigate: ((...a: Parameters<typeof nav0.navigate>) => (onLeave?.(), nav0.navigate(...a))) as typeof nav0.navigate };
  const { colors } = useTheme();
  const { clinicCourse: c, clinicVisits, looseBookings, plannedVisits, cases } = useJourney();
  // นัดตามแผนที่คลินิกลงไว้ล่วงหน้า (ของการรักษาที่ทำอยู่) — เรียงตามวัน · นัดแรก = นัดถัดไป
  const planned = Object.entries(plannedVisits)
    .flatMap(([caseId, vs]) => {
      const tc = cases.find((x) => x.id === caseId);
      return vs.map((v, i) => ({ ...v, caseId, no: (tc?.visits.length ?? 0) + 1 + i, topic: tc?.short ?? '' }));
    })
    .sort((a, b) => `${a.iso}${a.time}`.localeCompare(`${b.iso}${b.time}`));
  const plannedRow = (v: (typeof planned)[number], i: number, last: boolean) => (
    <Pressable
      key={v.id}
      accessibilityRole="button"
      accessibilityLabel={`ครั้งที่ ${v.no} ${v.date} ${v.time}`}
      onPress={i === 0 ? () => nav.navigate('AppointmentDetail', { caseId: v.caseId }) : undefined}
      style={({ pressed }) => ({ backgroundColor: pressed && i === 0 ? colors.surface.sunken : 'transparent' })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
        <View style={{ width: 44, alignItems: 'center' }}>
          <Text variant="bodyXs" tone="secondary">
            ครั้งที่
          </Text>
          <Text variant="titleMd">{v.no}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="labelMd">
            {v.iso ? thaiDate(v.iso) : v.date} · {v.time} น.
          </Text>
          <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
            {[v.therapist, v.topic ? `รักษา${v.topic}` : ''].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Tag text={i === 0 ? 'นัดถัดไป' : 'นัดแล้ว'} tone="good" />
        {i === 0 ? <Icon name="chevron-right" size="sm" color={colors.text.tertiary} /> : null}
      </View>
    </Pressable>
  );
  const plannedPanel = planned.length ? (
    <Panel title="นัดตามแผน" flush>
      {planned.map((v, i) => plannedRow(v, i, i === planned.length - 1))}
    </Panel>
  ) : null;
  const [open, setOpen] = React.useState<string | null>(null);
  const appts = looseBookings
    .filter((b): b is LooseBooking & { course: NonNullable<LooseBooking['course']> } => !!b.course)
    .sort((a, b) => `${a.iso ?? ''}${a.time}`.localeCompare(`${b.iso ?? ''}${b.time}`));
  const left = c ? Math.max(0, c.total - c.used) : 0;
  const row = (b: (typeof appts)[number], last: boolean) => {
    const date = b.iso ? isoToLabel(b.iso) : b.date;
    const today = date === 'วันนี้';
    return (
      <Pressable
        key={b.id}
        accessibilityRole="button"
        accessibilityLabel={`ครั้งที่ ${b.course.no} ${date} ${b.time}`}
        onPress={() => nav.navigate('AppointmentDetail', { looseId: b.id })}
        style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
          <View style={{ width: 44, alignItems: 'center' }}>
            <Text variant="bodyXs" tone="secondary">
              ครั้งที่
            </Text>
            <Text variant="titleMd">{b.course.no}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">
              {b.iso ? thaiDate(b.iso) : date} · {b.time} น.
            </Text>
            <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
              {[b.therapist, b.service].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Tag text={b.stage ? STAGE[b.stage] : today ? 'วันนี้' : 'นัดแล้ว'} tone={today || b.stage ? 'warn' : 'good'} />
          <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
        </View>
      </Pressable>
    );
  };
  // ประวัติการรักษาที่คลินิกบันทึก (ล่าสุดก่อน) · แตะ = ดูผลตรวจ หัตถการ คำแนะนำ
  const history = clinicVisits.length ? (
    <Panel title="ประวัติการรักษา" flush>
      {clinicVisits.map((v, i) => {
        const shown = open === v.id;
        const last = i === clinicVisits.length - 1;
        return (
          <Pressable key={v.id} accessibilityRole="button" accessibilityState={{ expanded: shown }} accessibilityLabel={`รักษา ${thaiDate(v.date)}`} onPress={() => setOpen(shown ? null : v.id)}>
            <View style={{ gap: space[2], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <IconBox icon="check" tint={TINT.green} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="labelMd">
                    {thaiDate(v.date)} · {v.start} น.
                  </Text>
                  <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                    {[v.service, v.therapist].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {v.painBefore !== undefined && v.painAfter !== undefined ? <Tag text={`ปวด ${v.painBefore} → ${v.painAfter}`} tone={v.painAfter < v.painBefore ? 'good' : undefined} /> : null}
                <Icon name={shown ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.text.tertiary} />
              </View>
              {shown ? (
                <View style={{ gap: space[1], paddingLeft: 36 + space[3] }}>
                  {v.findings ? <InfoRow k="ผลตรวจ" v={v.findings} /> : null}
                  {v.diagnoses?.length ? <InfoRow k="วินิจฉัย" v={v.diagnoses.join(', ')} /> : null}
                  {v.procedures?.length ? <InfoRow k="หัตถการ" v={v.procedures.join('\n')} /> : null}
                  {v.advice ? <InfoRow k="คำแนะนำ" v={v.advice} /> : null}
                  {!v.findings && !v.diagnoses?.length && !v.procedures?.length && !v.advice ? (
                    <Text variant="bodyXs" tone="secondary">
                      ไม่มีรายละเอียดเพิ่มเติม
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Panel>
  ) : null;
  return (
    <View style={{ gap: space[4] }}>
      {c ? (
        <>
          <Panel title={c.name} right={<Tag text={left ? `เหลือ ${left} ครั้ง` : 'ครบคอร์สแล้ว'} tone={left ? 'good' : undefined} />}>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <StatTile label="ใช้ไปแล้ว" value={String(c.used)} unit={`/ ${c.total} ครั้ง`} color={colors.brand.primary} />
              <StatTile label="นัดไว้" value={String(appts.length + planned.length)} unit="ครั้ง" />
            </View>
            <ProgressBar value={c.total ? c.used / c.total : 0} label={`รับบริการแล้ว ${c.used} จาก ${c.total} ครั้ง`} />
            <InfoRow k="บริการ" v={c.service} />
            {c.startedOn ? <InfoRow k="เปิดคอร์ส" v={thaiDate(c.startedOn)} /> : null}
            {c.expiresOn ? <InfoRow k="ใช้ได้ถึง" v={thaiDate(c.expiresOn)} /> : null}
          </Panel>
          {plannedPanel}
          {appts.length || !planned.length ? (
          <Panel title="นัดตามคอร์ส" flush>
            {appts.length ? (
              appts.map((b, i) => row(b, i === appts.length - 1))
            ) : (
              <View style={{ padding: space[4] }}>
                <Text variant="bodySm" tone="secondary">
                  ยังไม่มีนัดตามคอร์ส · คลินิกจัดตารางนัดให้แล้วจะขึ้นที่นี่
                </Text>
              </View>
            )}
          </Panel>
          ) : null}
          {history}
        </>
      ) : history || plannedPanel ? (
        <>
          {plannedPanel}
          {history}
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <IconBox icon="calendar" tint={TINT.green} size={56} />
          <Text variant="bodyMd" tone="secondary" align="center">
            ยังไม่มีคอร์สและประวัติการรักษา{'\n'}เมื่อคลินิกเปิดคอร์สหรือบันทึกการรักษา จะแสดงที่นี่
          </Text>
        </View>
      )}
    </View>
  );
}
