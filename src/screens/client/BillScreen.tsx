import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Button, Icon, IconBox, InfoRow, Panel, Screen, StatTile, TINT, Tag, Text, useTheme } from '../../design-system';
import { space } from '../../design-system/tokens';
import { useJourney, type Bill } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/**
 * การชำระเงิน — บิลที่คลินิกส่งมาให้จ่ายในแอป (หลังบ้าน: ส่งบิลในแอป ThaiWell AI) · จ่ายแล้วได้ใบเสร็จ
 * ⚠️ ต้นแบบ: ยังไม่ได้ต่อระบบชำระเงินจริง
 */
export function BillsScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { bills } = useJourney();
  const pending = bills.filter((b) => b.status === 'pending');
  const paid = bills.filter((b) => b.status === 'paid');
  const row = (b: Bill, last: boolean) => (
    <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.title} ${b.total} บาท`} onPress={() => nav.navigate('Bill', { id: b.id })} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surface.sunken : 'transparent' })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], marginHorizontal: space[4], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }}>
        <IconBox icon={b.status === 'pending' ? 'credit-card' : 'file-text'} tint={b.status === 'pending' ? TINT.amber : TINT.green} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="labelMd">{b.title}</Text>
          <Text variant="bodyXs" tone="secondary">
            {b.status === 'pending' ? `รับบริการ ${b.date}` : `ชำระแล้ว ${b.paidAt ?? ''}`}
          </Text>
        </View>
        <Text variant="labelLg">{b.total.toLocaleString()} ฿</Text>
        <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
      </View>
    </Pressable>
  );
  return (
    <Screen header={<AppBar title="การชำระเงิน" onBack={() => nav.goBack()} />}>
      {bills.length ? (
        <>
          {pending.length ? (
            <Panel title="รอชำระ" flush>
              {pending.map((b, i) => row(b, i === pending.length - 1))}
            </Panel>
          ) : null}
          {paid.length ? (
            <Panel title="ใบเสร็จ" flush>
              {paid.map((b, i) => row(b, i === paid.length - 1))}
            </Panel>
          ) : null}
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: space[3], paddingVertical: space[10] }}>
          <Icon name="file-text" size="xl" color={colors.text.tertiary} />
          <Text variant="bodyMd" tone="secondary">
            ยังไม่มีบิล
          </Text>
        </View>
      )}
    </Screen>
  );
}

export function BillScreen({ route }: { route: { params: { id: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { bills, payBill, log } = useJourney();
  const b = bills.find((x) => x.id === route.params.id);
  if (!b) return <NotFoundScreen title="บิล" />;
  const paid = b.status === 'paid';
  return (
    <Screen
      header={<AppBar title={paid ? 'ใบเสร็จ' : 'ชำระเงิน'} onBack={() => nav.goBack()} />}
      footer={
        paid ? undefined : (
          <Button
            label={`ชำระ ${b.total.toLocaleString()} บาท`}
            iconLeft="credit-card"
            onPress={() => {
              payBill(b.id);
              log('ผู้รับบริการ', `ชำระบิล ${b.title} ${b.total} บาท ในแอป`);
            }}
          />
        )
      }
    >
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[3] }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: paid ? colors.brand.subtle : colors.surface.sunken }}>
          <Icon name={paid ? 'check' : 'credit-card'} size="lg" color={paid ? colors.brand.primary : colors.text.secondary} />
        </View>
        <Text variant="titleLg">{paid ? 'ชำระเรียบร้อย' : 'รอชำระ'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <StatTile label="ยอดรวม" value={`${b.total.toLocaleString()}`} unit="บาท" color={paid ? colors.brand.primary : undefined} />
        <StatTile label="รับบริการ" value={b.date} small />
      </View>
      <Panel title={b.title} right={<Tag text={paid ? 'ชำระแล้ว' : 'รอชำระ'} tone={paid ? 'good' : 'warn'} />}>
        {b.items.map((it) => (
          <InfoRow key={it.name} k={it.name} v={`${it.amount.toLocaleString()} ฿`} />
        ))}
      </Panel>
      {paid ? (
        <Panel title="ใบเสร็จ">
          <InfoRow k="เลขที่" v={b.receiptNo ?? '-'} />
          <InfoRow k="ชำระเมื่อ" v={b.paidAt ?? '-'} />
        </Panel>
      ) : null}
    </Screen>
  );
}
