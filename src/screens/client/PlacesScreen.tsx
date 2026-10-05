import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, Badge, Card, ChipSection, Icon, Placeholder, Screen, Text, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useNav } from '../../navigation/types';

/* ============================================================ สถานที่ให้บริการ
 * เลือกสถานที่ก่อนจอง: ระยะทาง · คิวว่างวันนี้ · ใช้สิทธิบัตรทองได้ไหม · ผู้ให้บริการระดับไหน
 * สิทธิบัตรทอง: นวด ประคบ อบ ฟื้นฟูหลังคลอด (health profile 2568 หน้า 21)
 * ⚠️ ต้นแบบ: ข้อมูลสถานที่เป็นตัวอย่าง
 */
export interface Place {
  id: string;
  name: string;
  area: string;
  km: number;
  slots: string[];
  uc: boolean;
  /** มีแพทย์แผนไทย (ดูแลเรื่องที่ต้องรักษา ไม่ใช่แค่ผ่อนคลาย) */
  therapy: boolean;
}

export const PLACES: Place[] = [
  { id: 'skv', name: 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท', area: 'สุขุมวิท 39', km: 1.2, slots: ['13:00', '15:30'], uc: true, therapy: true },
  { id: 'ari', name: 'ศูนย์แพทย์แผนไทย อารีย์', area: 'พหลโยธิน 7', km: 3.4, slots: ['10:30', '17:00'], uc: true, therapy: true },
  { id: 'spa', name: 'บ้านนวดไทย ทองหล่อ', area: 'ทองหล่อ 10', km: 2.1, slots: ['14:00'], uc: false, therapy: false },
];

const FILTERS = ['ว่างวันนี้', 'บัตรทอง', 'แพทย์แผนไทย'];

export function PlacesScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const [filters, setFilters] = React.useState<string[]>([]);
  const list = PLACES.filter(
    (p) => (!filters.includes('ว่างวันนี้') || p.slots.length > 0) && (!filters.includes('บัตรทอง') || p.uc) && (!filters.includes('แพทย์แผนไทย') || p.therapy),
  ).sort((a, b) => a.km - b.km);

  return (
    <Screen header={<AppBar title="สถานที่" />}>
      <Placeholder height={160} label="แผนที่" icon="map" />
      <ChipSection options={FILTERS} value={filters} onChange={setFilters} />

      {list.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.name} ${p.km} กม.`}
          onPress={() => nav.navigate('ClientTabs', { screen: 'Booking', params: { clinic: p.name } } as never)}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brand.subtle, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="map-pin" color={colors.brand.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleSm">{p.name}</Text>
                <Text variant="bodySm" tone="secondary">
                  {p.km} กม. · {p.area}
                </Text>
              </View>
              <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1] }}>
              {p.slots.map((t) => (
                <Badge key={t} label={t} tone="neutral" />
              ))}
              {p.uc ? <Badge label="บัตรทอง" tone="success" /> : null}
              {p.therapy ? <Badge label="แพทย์แผนไทย" tone="brand" /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
