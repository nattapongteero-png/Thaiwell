import React from 'react';
import { ScrollView, View } from 'react-native';
import { AppBar, Button, Icon, Panel, Screen, Tag, Text, useTheme } from '../../../design-system';
import { radius, space } from '../../../design-system/tokens';
import { useNav } from '../../../navigation/types';
import { therapistsAt } from '../../../data/booking';
import { THERAPIST_CARD_W as CARD_W, TherapistCard } from './TherapistCard';
import { MY_LOCATION, PLACES, openMap } from '../PlacesScreen';
import { PlacesMap } from './PlacesMap';
import { NotFoundScreen } from '../NotFound';

/**
 * รายละเอียดสถานที่ — ข้อมูลที่ตัดออกจากการ์ดในรายการมาอยู่ที่นี่
 * แผนที่ · สิทธิ (บัตรทอง) · ผู้ให้บริการ (ดูอย่างเดียว) · บริการที่มี · จอง / นำทาง
 * เลือกบริการ → ผู้ให้บริการและเวลา ทำที่หน้าจองที่เดียว (ไม่เลือกซ้ำสองหน้า · คิวว่างขึ้นกับบริการที่เลือก)
 */
export function PlaceDetailScreen({ route }: { route: { params: { id: string } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const p = PLACES.find((x) => x.id === route.params.id);
  if (!p) return <NotFoundScreen title="สถานที่" />;
  const hospital = p.kind === 'hospital';
  const staff = therapistsAt(p.id);

  // การ์ดชุดเดียวกับหน้าอื่น (Panel: หัวข้อหนา · ข้อมูลข้างใน)
  const card = (title: string, children: React.ReactNode) => <Panel title={title}>{children}</Panel>;
  const pill = (t: string) => <Tag key={t} text={t} tone="good" />;
  /** มี/ไม่มี: ชื่อซ้าย · สถานะขวา (มี = ✓ เขียว · ไม่มี = ✕ แดง) */
  const fact = (label: string, ok: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Text variant="bodyMd" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name={ok ? 'check-circle' : 'x-circle'} size="sm" color={ok ? colors.brand.primary : colors.status.danger.fg} />
    </View>
  );

  return (
    <Screen
      header={<AppBar title={p.name} onBack={() => nav.goBack()} />}
      footer={
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button label="นำทาง" iconLeft="navigation" variant="secondary" onPress={() => openMap(p)} />
          </View>
          {/* โรงพยาบาล / ยังไม่มีตารางผู้ให้บริการ → ไม่มีปุ่มจอง (มีแค่นำทาง) */}
          {hospital || !staff.length ? null : (
            <View style={{ flex: 1.4 }}>
              <Button
                label="จองนวดที่นี่"
                iconLeft="calendar"
                onPress={() => nav.navigate('Booking', { clinic: p.name })}
              />
            </View>
          )}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon name="map-pin" size="sm" color={colors.brand.primary} />
        <Text variant="bodySm" tone="secondary">
          {p.km} กม. · {p.area}
        </Text>
      </View>
      <PlacesMap places={[{ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, slots: p.slots.length }]} me={MY_LOCATION} selected={p.id} height={200} />

      {card(
        'สิทธิและผู้ให้บริการ',
        <View style={{ gap: space[2] }}>
          {fact('ใช้สิทธิบัตรทองได้', p.uc)}
          {fact('มีแพทย์แผนไทย (นวดเพื่อรักษา)', p.therapy)}
        </View>,
      )}

      {/* ผู้ให้บริการ: การ์ดรายคน เลื่อนแนวนอน · เลือกเวลาว่างของคนนั้นได้ในการ์ด */}
      {/* ผู้ให้บริการ: รู้จักก่อนว่าใครดูแล (เลื่อนแนวนอน) · เลือกคน/เวลาที่หน้าจอง */}
      {staff.length ? (
        <View style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text variant="labelLg">ผู้ให้บริการ</Text>
            <Text variant="bodyXs" tone="tertiary">
              {staff.length} คน
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + space[3]} decelerationRate="fast" style={{ marginHorizontal: -space[4] }} contentContainerStyle={{ gap: space[3], paddingHorizontal: space[4] }}>
            {staff.map((s) => (
              <TherapistCard key={s.id} t={s} compact />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {p.services.length ? card('บริการ', <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{p.services.map((s) => pill(s))}</View>) : null}
    </Screen>
  );
}
