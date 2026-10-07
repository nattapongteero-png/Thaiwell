import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Icon, IconBox, InfoRow, Panel, ProgressBar, Screen, StatTile, TINT, Tag, Text, useTheme } from '../../design-system';
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
  const { colors } = useTheme();
  const { clinicCourse: c, clinicVisits, looseBookings, courseSlots, cases } = useJourney();
  const [open, setOpen] = React.useState<string | null>(null);
  // นัดตามคอร์ส: ผูกกับเรื่องที่รักษาอยู่ (ประเมินก่อนนวด/เช็กอินที่นัดถัดไปของเรื่อง) + นัดแยก (ยังไม่มีเรื่อง)
  const appts = [
    ...looseBookings
      .filter((b): b is LooseBooking & { course: NonNullable<LooseBooking['course']> } => !!b.course)
      .map((b) => ({ id: b.id, iso: b.iso, date: b.date, time: b.time, therapist: b.therapist, service: b.service, course: b.course, stage: b.stage, target: { looseId: b.id } })),
    ...courseSlots
      .filter((x): x is typeof x & { course: NonNullable<typeof x.course> } => !!x.course)
      .map((x, i, arr) => {
        const tc = cases.find((cc) => cc.id === x.caseId);
        const next = arr.findIndex((y) => y.caseId === x.caseId) === i;
        return { id: x.ref, iso: x.iso, date: x.iso, time: x.time, therapist: x.therapist, service: x.service, course: x.course, stage: next ? tc?.appointment.stage : undefined, target: { caseId: x.caseId } };
      }),
  ].sort((a, b) => `${a.iso ?? ''}${a.time}`.localeCompare(`${b.iso ?? ''}${b.time}`));
  const left = c ? Math.max(0, c.total - c.used) : 0;
  const row = (b: (typeof appts)[number], last: boolean) => {
    const date = b.iso ? isoToLabel(b.iso) : b.date;
    const today = date === 'วันนี้';
    return (
      <Pressable
        key={b.id}
        accessibilityRole="button"
        accessibilityLabel={`ครั้งที่ ${b.course.no} ${date} ${b.time}`}
        onPress={() => nav.navigate('AppointmentDetail', b.target)}
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
    <Screen header={<AppBar title="คอร์สและประวัติการรักษา" onBack={() => nav.goBack()} />}>
      {c ? (
        <>
          <Panel title={c.name} right={<Tag text={left ? `เหลือ ${left} ครั้ง` : 'ครบคอร์สแล้ว'} tone={left ? 'good' : undefined} />}>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <StatTile label="ใช้ไปแล้ว" value={String(c.used)} unit={`/ ${c.total} ครั้ง`} color={colors.brand.primary} />
              <StatTile label="นัดไว้" value={String(appts.length)} unit="ครั้ง" />
            </View>
            <ProgressBar value={c.total ? c.used / c.total : 0} label={`รับบริการแล้ว ${c.used} จาก ${c.total} ครั้ง`} />
            <InfoRow k="บริการ" v={c.service} />
            <InfoRow k="การชำระ" v={c.billing === 'prepaid' ? 'จ่ายคอร์สล่วงหน้าแล้ว · มาแต่ละครั้งหักเครดิต' : 'ชำระรายครั้งที่มารักษา (รวมหัตถการที่ทำเพิ่ม)'} />
            {c.startedOn ? <InfoRow k="เปิดคอร์ส" v={thaiDate(c.startedOn)} /> : null}
            {c.expiresOn ? <InfoRow k="ใช้ได้ถึง" v={thaiDate(c.expiresOn)} /> : null}
          </Panel>
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
          {history}
        </>
      ) : history ? (
        history
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <IconBox icon="calendar" tint={TINT.green} size={56} />
          <Text variant="bodyMd" tone="secondary" align="center">
            ยังไม่มีคอร์สและประวัติการรักษา{'\n'}เมื่อคลินิกเปิดคอร์สหรือบันทึกการรักษา จะแสดงที่นี่
          </Text>
        </View>
      )}
    </Screen>
  );
}
