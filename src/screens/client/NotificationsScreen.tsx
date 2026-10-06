import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Icon, IconBox, Panel, Screen, TINT, Text, useTheme, type IconName } from '../../design-system';
import { space } from '../../design-system/tokens';
import { useJourney, type ApptNotice } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/**
 * การแจ้งเตือน — นัดของการรักษาที่คลินิกเปลี่ยนให้ (เลื่อน / ยกเลิก / ยืนยัน) · ผู้ใช้เปลี่ยนเองในแอปไม่ได้
 * ใหม่ (ยังไม่อ่าน) อยู่บน · แตะ = รายละเอียดนัดของเรื่องนั้น และถือว่าอ่านแล้ว
 */
const KIND: Record<ApptNotice['kind'], { icon: IconName; tint: string; title: string }> = {
  moved: { icon: 'calendar', tint: TINT.amber, title: 'เลื่อนนัด' },
  cancelled: { icon: 'x-circle', tint: TINT.red, title: 'ยกเลิกนัด' },
  confirmed: { icon: 'check-circle', tint: TINT.green, title: 'ยืนยันนัด' },
  rejected: { icon: 'slash', tint: TINT.red, title: 'คำขอจองไม่สำเร็จ' },
  reminder: { icon: 'clock', tint: TINT.blue, title: 'เตือนนัด' },
  noshow: { icon: 'user-x', tint: TINT.red, title: 'ไม่มาตามนัด' },
  waitlist: { icon: 'users', tint: TINT.violet, title: 'มีคิวว่าง' },
  bill: { icon: 'credit-card', tint: TINT.amber, title: 'บิลรอชำระ' },
  receipt: { icon: 'file-text', tint: TINT.green, title: 'ใบเสร็จ' },
  followup: { icon: 'activity', tint: TINT.violet, title: 'ติดตามผล' },
};

export function NotificationsScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { apptNotices, dismissNotice, markAllNoticesRead } = useJourney();
  const fresh = apptNotices.filter((n) => !n.read);
  const old = apptNotices.filter((n) => n.read);

  const row = (n: ApptNotice, last: boolean) => {
    const k = KIND[n.kind];
    return (
      <Pressable
        key={n.id}
        accessibilityRole="button"
        accessibilityLabel={`${k.title} ${n.text}`}
        onPress={() => {
          dismissNotice(n.id);
          // ไปที่เรื่องของแจ้งเตือน: บิล/ใบเสร็จ → หน้าบิล · ติดตามผล → ประเมินในแชทของเรื่องนั้น · มีคิวว่าง → จองเรื่องใหม่ · นัด → รายละเอียดนัด
          if (n.billId) return nav.navigate('Bill', { id: n.billId });
          if (n.kind === 'followup') return nav.popTo('ClientTabs', { screen: 'Home', params: { assessCase: n.caseId } });
          if (n.kind === 'waitlist' || n.kind === 'rejected') return nav.navigate('Booking');
          nav.navigate('AppointmentDetail', { caseId: n.caseId, draftId: n.draftId, looseId: n.looseId });
        }}
        style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
          <IconBox icon={k.icon} tint={k.tint} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">{k.title}</Text>
            <Text variant="bodySm" tone={n.read ? 'secondary' : 'primary'}>
              {n.text}
            </Text>
            <Text variant="caption" tone="tertiary">
              {n.at}
            </Text>
          </View>
          {/* ยังไม่อ่าน = จุดสีหลักของแอป */}
          {n.read ? null : <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, backgroundColor: colors.brand.primary }} />}
        </View>
      </Pressable>
    );
  };

  return (
    <Screen header={<AppBar title="การแจ้งเตือน" onBack={() => nav.goBack()} />}>
      {apptNotices.length ? (
        <>
          {fresh.length ? (
            <Panel
              title="ใหม่"
              right={
                <Pressable accessibilityRole="button" onPress={markAllNoticesRead} hitSlop={8}>
                  <Text variant="labelMd" color={colors.brand.primary}>
                    อ่านทั้งหมด
                  </Text>
                </Pressable>
              }
              flush
            >
              {fresh.map((n, i) => row(n, i === fresh.length - 1))}
            </Panel>
          ) : null}
          {old.length ? (
            <Panel title="ก่อนหน้า" flush>
              {old.map((n, i) => row(n, i === old.length - 1))}
            </Panel>
          ) : null}

        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <Icon name="bell" size="xl" color={colors.text.tertiary} />
          <Text variant="bodyMd" tone="secondary">
            ยังไม่มีการแจ้งเตือน
          </Text>
        </View>
      )}
    </Screen>
  );
}
