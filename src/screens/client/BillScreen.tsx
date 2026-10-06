import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Button, Icon, IconBox, Panel, Screen, TINT, Text, fontFamily, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney, type Bill } from '../../state/JourneyContext';
import { CASE_CLINIC_DEFAULT } from '../../state/appointments';
import { useNav } from '../../navigation/types';
import { NotFoundScreen } from './NotFound';

/** วิธีชำระ (ชุดเดียวกับหลังบ้าน) → ป้ายในแอป · จ่ายในแอป หรือจ่ายที่เคาน์เตอร์ */
const METHOD: Record<NonNullable<Bill['method']>, { label: string; where: 'app' | 'counter' }> = {
  app: { label: 'ชำระในแอป', where: 'app' },
  cash: { label: 'เงินสด · เคาน์เตอร์', where: 'counter' },
  promptpay: { label: 'QR พร้อมเพย์ · เคาน์เตอร์', where: 'counter' },
  credit: { label: 'หักเครดิตคอร์ส', where: 'counter' },
};
const methodLabel = (b: Bill) => (b.method ? METHOD[b.method].label : 'ชำระแล้ว');

/**
 * การชำระเงิน — รอชำระ (จ่ายในแอป หรือที่เคาน์เตอร์) · ชำระแล้ว (ใบเสร็จจากระบบคลินิก)
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
            {b.status === 'pending' ? `รับบริการ ${b.date}` : `${methodLabel(b)} · ${b.paidAt ?? ''}`}
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
            <Panel title="ชำระแล้ว" flush>
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
  const { bills, payBill, log, cases, client } = useJourney();
  const b = bills.find((x) => x.id === route.params.id);
  if (!b) return <NotFoundScreen title="บิล" />;
  const paid = b.status === 'paid';
  const tc = cases.find((c) => c.id === b.caseId);
  const clinic = tc?.clinic ?? CASE_CLINIC_DEFAULT;

  // ชำระแล้ว → ใบเสร็จ (หน้าตาเดียวกับใบเสร็จของหลังบ้าน)
  if (paid) {
    const meta: [string, string][] = [
      ['เลขที่', b.receiptNo ?? '-'],
      ['วันที่ชำระ', b.paidAt ?? '-'],
      ['ผู้รับบริการ', client.name],
      ...(b.therapist || tc?.therapist ? ([['ผู้บำบัด', b.therapist || tc!.therapist]] as [string, string][]) : []),
      ['รับบริการ', b.date],
    ];
    return (
      <Screen header={<AppBar title="ใบเสร็จ" onBack={() => nav.goBack()} />}>
        <View style={{ backgroundColor: colors.surface.default, borderRadius: 24, borderWidth: 1, borderColor: colors.border.subtle, padding: space[5], gap: space[4] }}>
          {/* หัว: คลินิก + ชนิดเอกสาร · ตราชำระแล้ว */}
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="titleSm" align="center">
              {clinic}
            </Text>
            <Text variant="bodyXs" tone="tertiary">
              ใบเสร็จรับเงิน · RECEIPT
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: space[1] }}>
            <Text variant="bodyXs" tone="secondary">
              ยอดชำระ
            </Text>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 52, color: colors.text.primary }}>
              {b.total.toLocaleString()}
              <Text variant="titleSm" tone="secondary">
                {' '}
                บาท
              </Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space[3], paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.brand.subtle }}>
              <Icon name="check" size="xs" color={colors.brand.primary} />
              <Text variant="labelSm" color={colors.brand.primary} style={{ transform: [{ translateY: 1 }] }}>
                ชำระแล้ว · {methodLabel(b)}
              </Text>
            </View>
          </View>
          <Dash />
          <View style={{ gap: space[2] }}>
            {meta.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                <Text variant="bodySm" tone="secondary">
                  {k}
                </Text>
                <Text variant="bodySm" style={{ flexShrink: 1, textAlign: 'right' }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>
          <Dash />
          <View style={{ gap: space[2] }}>
            {b.items.map((it) => (
              <View key={it.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                <Text variant="bodyMd" style={{ flex: 1 }}>
                  {it.name}
                </Text>
                <Text variant="bodyMd">{it.amount.toLocaleString()}</Text>
              </View>
            ))}
          </View>
          <Dash />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="titleSm">รวมทั้งสิ้น</Text>
            <Text variant="titleSm">{b.total.toLocaleString()} ฿</Text>
          </View>
          <Text variant="bodyXs" tone="tertiary" align="center">
            ขอบคุณที่ใช้บริการ
          </Text>
        </View>
      </Screen>
    );
  }

  // รอชำระ → เลือกจ่ายในแอป หรือจ่ายที่เคาน์เตอร์ (คลินิกบันทึกแล้วใบเสร็จเข้าแอปเอง)
  return (
    <Screen
      header={<AppBar title="ชำระเงิน" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={`ชำระในแอป ${b.total.toLocaleString()} บาท`}
          iconLeft="credit-card"
          onPress={() => {
            payBill(b.id);
            log('ผู้รับบริการ', `ชำระบิล ${b.title} ${b.total} บาท ในแอป`);
          }}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: space[1], paddingVertical: space[3] }}>
        <Text variant="bodySm" tone="secondary">
          ยอดที่ต้องชำระ
        </Text>
        <Text style={{ fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 52, color: colors.text.primary }}>
          {b.total.toLocaleString()}
          <Text variant="titleSm" tone="secondary">
            {' '}
            บาท
          </Text>
        </Text>
        <Text variant="bodySm" tone="secondary">
          {b.title} · {b.date}
        </Text>
      </View>
      <Panel title="รายการ">
        {b.items.map((it) => (
          <View key={it.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
            <Text variant="bodyMd" style={{ flex: 1 }}>
              {it.name}
            </Text>
            <Text variant="bodyMd">{it.amount.toLocaleString()} ฿</Text>
          </View>
        ))}
      </Panel>
      <Panel title="ชำระได้ 2 ทาง">
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <IconBox icon="smartphone" tint={TINT.green} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">ชำระในแอป</Text>
            <Text variant="bodySm" tone="secondary">
              กดปุ่มด้านล่าง ใบเสร็จขึ้นในแอปทันที
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
          <IconBox icon="home" tint={TINT.amber} size={36} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="labelMd">ชำระที่เคาน์เตอร์</Text>
            <Text variant="bodySm" tone="secondary">
              เงินสดหรือ QR พร้อมเพย์ ใบเสร็จจะส่งเข้าแอปหลังชำระ
            </Text>
          </View>
        </View>
      </Panel>
    </Screen>
  );
}

/** เส้นประคั่นแบบใบเสร็จ */
function Dash() {
  const { colors } = useTheme();
  return <View style={{ height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border.default }} />;
}
