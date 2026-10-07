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
  const { clinicCourse: c, looseBookings } = useJourney();
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
  return (
    <Screen header={<AppBar title="คอร์สการรักษา" onBack={() => nav.goBack()} />}>
      {c ? (
        <>
          <Panel title={c.name} right={<Tag text={left ? `เหลือ ${left} ครั้ง` : 'ครบคอร์สแล้ว'} tone={left ? 'good' : undefined} />}>
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <StatTile label="ใช้ไปแล้ว" value={String(c.used)} unit={`/ ${c.total} ครั้ง`} color={colors.brand.primary} />
              <StatTile label="นัดไว้" value={String(appts.length)} unit="ครั้ง" />
            </View>
            <ProgressBar value={c.total ? c.used / c.total : 0} label={`รับบริการแล้ว ${c.used} จาก ${c.total} ครั้ง`} />
            <InfoRow k="บริการ" v={c.service} />
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
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <IconBox icon="calendar" tint={TINT.green} size={56} />
          <Text variant="bodyMd" tone="secondary" align="center">
            ยังไม่มีคอร์สการรักษา{'\n'}เมื่อคลินิกเปิดคอร์สให้ จะแสดงจำนวนครั้งและนัดตามวันที่นี่
          </Text>
        </View>
      )}
    </Screen>
  );
}
