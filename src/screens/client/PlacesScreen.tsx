import React from 'react';
import { distanceKm, kmText, locate, myLocation, onLocation } from '../../services/location';
import { isCloud, readAvailability } from '../../services/clinicBridge';
import { onAvailability } from '../../services/cloudBridge';
import { Linking, Pressable, View } from 'react-native';
import { AppBar, Badge, Button, BottomSheet, ChipSection, Icon, Screen, Text, useTheme, ScreenSkeleton, useScreenData } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useNavigation } from '@react-navigation/native';
import { useNav } from '../../navigation/types';
import { PlacesMap } from './places/PlacesMap';
import { BRIDGE_PLACE, anyoneSlots, dayLabel, liveTherapists } from '../../data/booking';

/* ============================================================ สถานที่ให้บริการ
 * เลือกสถานที่ก่อนจอง: ระยะทาง · คิวว่างวันนี้ · ใช้สิทธิบัตรทองได้ไหม · ผู้ให้บริการระดับไหน
 * สิทธิบัตรทอง: นวด ประคบ อบ ฟื้นฟูหลังคลอด (health profile 2568 หน้า 21)
 * โหมดพบแพทย์ (ผลประเมินให้พบแพทย์ก่อน): แสดงโรงพยาบาลใกล้คุณแทนคลินิกนวด
 * ⚠️ ต้นแบบ: ข้อมูลสถานที่เป็นตัวอย่าง (ชื่อสมมติ)
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
  /** clinic = นวด/แพทย์แผนไทย · hospital = พบแพทย์ (กรณีผลประเมินให้พบแพทย์ก่อน) */
  kind: 'clinic' | 'hospital';
  /** บริการเสริมที่มี (ใช้จับคู่กับแนวทางการรักษา) */
  services: string[];
  /** เบอร์โทรคลินิก (ตัวอย่าง) — เลื่อน/ยกเลิกนัดของการรักษาทำผ่านคลินิก */
  phone?: string;
  /** พิกัด (ตัวอย่าง: ย่านจริงในกรุงเทพฯ) */
  lat: number;
  lng: number;
}

/** ตำแหน่งผู้ใช้ (ตัวอย่าง · ต่อ GPS จริงภายหลัง) */
export const MY_LOCATION = { lat: 13.7305, lng: 100.5672 };

const PLACE_LIST: Place[] = [
  { id: 'skv', phone: '02-258-1234', name: 'คลินิกแพทย์แผนไทย สาขาสุขุมวิท', area: 'สุขุมวิท 39', km: 1.2, slots: ['13:00', '15:30'], uc: true, therapy: true, kind: 'clinic', services: ['นวด', 'ประคบ', 'อบ', 'พอก'], lat: 13.7337, lng: 100.5717 },
  { id: 'ari', phone: '02-279-5678', name: 'ศูนย์แพทย์แผนไทย อารีย์', area: 'พหลโยธิน 7', km: 3.4, slots: ['10:30', '17:00'], uc: true, therapy: true, kind: 'clinic', services: ['นวด', 'ประคบ', 'แช่'], lat: 13.7795, lng: 100.5446 },
  { id: 'spa', phone: '02-381-9012', name: 'บ้านนวดไทย ทองหล่อ', area: 'ทองหล่อ 10', km: 2.1, slots: ['14:00'], uc: false, therapy: false, kind: 'clinic', services: ['นวด'], lat: 13.7347, lng: 100.5826 },
  { id: 'hsp1', phone: '02-391-3456', name: 'โรงพยาบาลชุมชน สุขุมวิท', area: 'สุขุมวิท 42', km: 1.8, slots: [], uc: true, therapy: false, kind: 'hospital', services: [], lat: 13.7196, lng: 100.5853 },
  { id: 'hsp2', phone: '02-249-7890', name: 'ศูนย์บริการสาธารณสุข คลองเตย', area: 'พระราม 4', km: 2.6, slots: [], uc: true, therapy: false, kind: 'hospital', services: [], lat: 13.7213, lng: 100.5578 },
];
/** คิวว่างวันนี้ = จากตารางที่ผู้ให้บริการลงไว้จริง (ไม่ใช่ค่าตายตัว) → รายการ/แผนที่/หน้าจองตรงกัน */
// "ว่างวันนี้" คำนวณทุกครั้งที่อ่าน → คลินิกที่เชื่อมหลังบ้าน (เปิดอยู่) แสดงเวลาว่างจริงของคลินิก ไม่ใช่ค่าตอนเปิดแอป
export const PLACES: Place[] = PLACE_LIST.map((p) =>
  p.kind === 'clinic' ? Object.defineProperty({ ...p }, 'slots', { enumerable: true, get: () => anyoneSlots(p.id).filter((f) => f.day === 0).map((f) => f.time) }) : p,
);

/**
 * ใช้งานจริง (cloud): รายการสถานที่ = คลินิกที่ใช้ระบบ ThaiWell เท่านั้น — ชื่อ ที่อยู่ เบอร์ พิกัด จากหน้าตั้งค่าของคลินิก
 * ระยะทางคำนวณจากตำแหน่งจริงของผู้ใช้ · สถานที่ตัวอย่างอื่น (คลินิก/โรงพยาบาลสมมติ) ไม่แสดง
 */
export function syncLivePlaces() {
  if (!isCloud()) return;
  const a = readAvailability();
  if (!a) {
    PLACES.splice(0, PLACES.length);
    return;
  }
  const c = a.clinic;
  const base = PLACE_LIST.find((p) => p.id === BRIDGE_PLACE)!;
  const live = { ...base, name: c?.name ?? a.clinicName ?? base.name, area: c?.address ?? '', phone: c?.phone, lat: c?.lat ?? NaN, lng: c?.lng ?? NaN } as Place;
  Object.defineProperty(live, 'slots', { enumerable: true, get: () => anyoneSlots(BRIDGE_PLACE).filter((f) => f.day === 0).map((f) => f.time) });
  Object.defineProperty(live, 'km', { enumerable: true, get: () => distanceKm(c?.lat, c?.lng) });
  PLACES.splice(0, PLACES.length, live);
}
if (isCloud()) {
  syncLivePlaces();
  onAvailability(syncLivePlaces);
}

/** แนะนำที่ใกล้ที่สุด: นวดรักษา = มีแพทย์แผนไทย + บัตรทอง + มีคิว · พบแพทย์ = โรงพยาบาล */
// คลินิกที่เชื่อมหลังบ้าน (มีเวลาว่างจริงจากคลินิก) มาก่อน แม้วันนี้เต็มแล้ว — จองแล้วคลินิกเห็นทันที
export const nearestClinic = () =>
  (liveTherapists() && anyoneSlots(BRIDGE_PLACE).length ? PLACES.find((p) => p.id === BRIDGE_PLACE) : undefined) ??
  PLACES.filter((p) => p.kind === 'clinic' && p.therapy && p.uc && p.slots.length).sort((a, b) => a.km - b.km)[0] ??
  // ยังไม่มีเวลาว่างที่ไหนเลย (เช่น ยังไม่ได้เวลาว่างจริงจากคลินิก) → คลินิกที่ใกล้ที่สุด (ไม่ให้การ์ดว่าง/ล่ม)
  PLACES.filter((p) => p.kind === 'clinic' && p.therapy).sort((a, b) => a.km - b.km)[0];
/** คิวว่างถัดไปของสถานที่ เป็นป้าย ("13:00" วันนี้ · "พรุ่งนี้ 09:00") */
export const nextSlotLabels = (placeId: string, n = 3) => anyoneSlots(placeId).slice(0, n).map((f) => (f.day === 0 ? f.time : `${dayLabel(f.day)} ${f.time}`));
export const nearestHospital = () => PLACES.filter((p) => p.kind === 'hospital').sort((a, b) => a.km - b.km)[0];
/** บริการเสริมที่แนวทางการรักษาใช้ (จากชื่อวิธีรักษา) */
export const neededServices = (methods: string[]) => ['ประคบ', 'พอก', 'แช่', 'อบ'].filter((x) => methods.some((m) => m.includes(x)));
/**
 * แนะนำสถานที่ตามแนวทาง (ใช้ในแชทจองกับ AI):
 * 1) ต้องมีแพทย์แผนไทย (นวดเพื่อรักษา — health profile 2568 หน้า 34) · มีคิวว่าง
 * 2) เรียงตามบริการที่ตรงแนวทางมากสุด → ใช้บัตรทองได้ → ใกล้สุด
 * เหตุผลที่แนะนำส่งกลับไปแสดงในการ์ด
 */
export function rankPlaces(methods: string[], limit = 3): { place: Place; reason: string }[] {
  const need = neededServices(methods);
  return PLACES.filter((p) => p.kind === 'clinic' && p.therapy && p.slots.length)
    .map((p) => {
      const has = need.filter((x) => p.services.includes(x));
      return { p, has, score: has.length * 10 + (p.uc ? 3 : 0) - p.km };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p, has }) => ({ place: p, reason: ['มีแพทย์แผนไทย', ...(has.length ? [`มีบริการ${has.join(' ')}`] : []), ...(p.uc ? ['ใช้บัตรทองได้'] : [])].join(' ') }));
}

/** โทรหาคลินิกตามชื่อ (ไม่พบ = คลินิกหลัก) */
// คลินิกที่ใช้ระบบ (ข้อมูลจริงจากคลินิก) ก่อน · ไม่พบ = คลินิกหลัก
const placeByName = (name?: string) => PLACES.find((x) => x.name === name) ?? PLACE_LIST.find((x) => x.name === name) ?? PLACES.find((x) => x.id === BRIDGE_PLACE) ?? (isCloud() ? { ...PLACE_LIST[0], phone: '' } : PLACE_LIST[0]);
export const callClinic = (name?: string) => {
  const p = placeByName(name);
  if (p.phone) Linking.openURL(`tel:${p.phone.replace(/-/g, '')}`).catch(() => {});
};
export const clinicPhone = (name?: string) => placeByName(name).phone ?? '';

/** นำทางด้วยแอปแผนที่ (ต้นแบบ: ค้นตามชื่อ) */
// มีพิกัด → นำทางไปจุดนั้นตรง ๆ · ไม่มี → ค้นจากชื่อ + ที่อยู่
export const openMap = (p: Place) =>
  Linking.openURL(Number.isFinite(p.lat) && Number.isFinite(p.lng) ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.area}`)}`);
/** หาโรงพยาบาลใกล้ตัวใน Google Maps (ใช้งานจริงไม่มีรายชื่อโรงพยาบาลในแอป) */
export const searchHospitals = () => {
  const me = myLocation();
  return Linking.openURL(me ? `https://www.google.com/maps/search/%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%9E%E0%B8%A2%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%A5/@${me.lat},${me.lng},14z` : 'https://www.google.com/maps/search/?api=1&query=%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B8%9E%E0%B8%A2%E0%B8%B2%E0%B8%9A%E0%B8%B2%E0%B8%A5%E0%B9%83%E0%B8%81%E0%B8%A5%E0%B9%89%E0%B8%89%E0%B8%B1%E0%B8%99');
};

const FILTERS = ['ว่างวันนี้', 'บัตรทอง', 'แพทย์แผนไทย'];

export function PlacesScreen({ route }: { route?: { params?: { mode?: 'doctor' } } }) {
  // โหลดข้อมูลของหน้า (ครั้งแรก) → skeleton
  const loading = useScreenData('places');
  const nav = useNav();
  const { colors } = useTheme();
  const doctor = route?.params?.mode === 'doctor';
  // แท็บจำ params ไว้ → ล้างโหมดพบแพทย์เมื่อกดแท็บสถานที่เอง (ไม่ล้างตอนเปิดรายละเอียดโรงพยาบาลแล้วย้อนกลับมา)
  const tabNav = useNavigation();
  React.useEffect(
    () => (tabNav as unknown as { addListener: (e: string, cb: () => void) => () => void }).addListener('tabPress', () => (tabNav as unknown as { setParams: (p: object) => void }).setParams({ mode: undefined })),
    [tabNav],
  );
  const [filters, setFilters] = React.useState<string[]>([]);
  // ตำแหน่งผู้ใช้ (ระยะทางจริง) + ข้อมูลคลินิกจากระบบ → วาดใหม่เมื่อได้มา
  const [, refresh] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    void locate();
    const a = onLocation(refresh);
    const b = onAvailability(refresh);
    return () => {
      a();
      b();
    };
  }, []);
  const [picked, setPicked] = React.useState<string | null>(null);
  const list = PLACES.filter((p) => (doctor ? p.kind === 'hospital' : p.kind === 'clinic'))
    .filter(
      (p) => doctor || ((!filters.includes('ว่างวันนี้') || p.slots.length > 0) && (!filters.includes('บัตรทอง') || p.uc) && (!filters.includes('แพทย์แผนไทย') || p.therapy)),
    )
    .sort((a, b) => a.km - b.km);

  return (
    <Screen header={<AppBar title={doctor ? 'พบแพทย์ใกล้คุณ' : 'สถานที่'} onBack={doctor ? () => nav.goBack() : undefined} />}>
      {loading ? (
        <ScreenSkeleton variant="list" count={4} />
      ) : (
      <>
      {/* แผนที่ 3 มิติ (MapLibre + OpenFreeMap · ฟรี) · แตะหมุด = เลื่อนไปการ์ดนั้น */}
      <PlacesMap
        places={list.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, slots: p.slots.length }))}
        me={isCloud() ? myLocation() : MY_LOCATION}
        selected={picked ?? undefined}
        onPick={setPicked}
      />
      {doctor ? null : <ChipSection options={FILTERS} value={filters} onChange={setFilters} />}

      {/* ใช้งานจริง: โรงพยาบาลค้นใน Google Maps · ยังไม่มีคลินิกเปิดรับจอง → บอกตรง ๆ */}
      {isCloud() && doctor ? <Button label="ค้นหาโรงพยาบาลใกล้ฉันใน Google Maps" iconLeft="navigation" onPress={() => void searchHospitals()} /> : null}
      {isCloud() && !doctor && !list.length ? (
        <Text variant="bodySm" tone="secondary" align="center">
          ยังไม่มีคลินิกที่เปิดรับจองผ่านแอป
        </Text>
      ) : null}
      {/* การ์ดสถานที่: ชื่อ + ระยะทาง/ย่าน (รายละเอียด คิว สิทธิ ผู้ให้บริการ → หน้ารายละเอียด) */}
      {list.map((p) => {
        const on = picked === p.id;
        const hosp = p.kind === 'hospital';
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name} ${kmText(p)} ดูรายละเอียด`}
            onPress={() => nav.navigate('PlaceDetail', { id: p.id })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[3],
              padding: space[3],
              borderRadius: 20,
              backgroundColor: colors.surface.default,
              borderWidth: on ? 2 : 1,
              borderColor: on ? colors.brand.primary : colors.border.subtle,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: hosp ? colors.status.danger.bg : colors.brand.subtle }}>
              <Icon name={hosp ? 'plus-square' : 'map-pin'} color={hosp ? colors.status.danger.fg : colors.brand.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="labelLg" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="bodyXs" tone="secondary" numberOfLines={1}>
                {p.area}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Text variant="labelMd">{kmText(p)}</Text>
              <Icon name="chevron-right" size="sm" color={colors.text.tertiary} />
            </View>
          </Pressable>
        );
      })}
      </>
      )}
    </Screen>
  );
}

/**
 * สถานที่ทั้งหมดแบบ bottom sheet — เปิดจากแชทจองกับ AI (ไม่ต้องออกจากแชท)
 * พื้นหลังจางขึ้นอยู่กับที่ (ไม่เลื่อน) · เฉพาะ sheet เลื่อนขึ้น · ปัดลง/แตะพื้นหลัง/✕ = ปิด
 * เลือกที่ → ปิด sheet แล้วแชทถามผู้ให้บริการต่อ
 */
export function PlacesSheet({ visible, onClose, onPick, recommendedId }: { visible: boolean; onClose: () => void; onPick: (placeId: string) => void; recommendedId?: string }) {
  const { colors } = useTheme();
  const [filters, setFilters] = React.useState<string[]>([]);
  const list = PLACES.filter((p) => p.kind === 'clinic')
    .filter((p) => (!filters.includes('ว่างวันนี้') || p.slots.length > 0) && (!filters.includes('บัตรทอง') || p.uc) && (!filters.includes('แพทย์แผนไทย') || p.therapy))
    .sort((a, b) => (a.id === recommendedId ? -1 : b.id === recommendedId ? 1 : a.km - b.km));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="สถานที่ทั้งหมด" subtitle={`${list.length} แห่งใกล้คุณ`} header={<ChipSection options={FILTERS} value={filters} onChange={setFilters} />}>
          {list.map((p) => {
            const rec = p.id === recommendedId;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`เลือก ${p.name}`}
                onPress={() => onPick(p.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  gap: space[3],
                  padding: space[4],
                  borderRadius: 24,
                  backgroundColor: colors.surface.default,
                  borderWidth: rec ? 2 : 1,
                  borderColor: rec ? colors.brand.primary : colors.border.subtle,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}
              >
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: p.therapy ? colors.brand.subtle : colors.surface.sunken, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={p.therapy ? 'plus-circle' : 'map-pin'} color={p.therapy ? colors.brand.primary : colors.text.secondary} />
                </View>
                <View style={{ flex: 1, gap: space[2] }}>
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Text variant="labelLg" numberOfLines={1} style={{ flex: 1 }}>
                        {p.name}
                      </Text>
                      {rec ? <Badge label="แนะนำ" tone="brand" /> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
                      <Icon name="navigation" size="xs" color={colors.text.tertiary} />
                      <Text variant="caption" tone="secondary">
                        {kmText(p)} {p.area}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[1] }}>
                    {p.therapy ? <Badge label="แพทย์แผนไทย" tone="brand" /> : <Badge label="นวดเพื่อสุขภาพ" tone="neutral" />}
                    {p.uc ? <Badge label="บัตรทอง" tone="success" /> : null}
                  </View>
                  {p.slots.length ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                      <Text variant="caption" tone="tertiary">
                        ว่างวันนี้
                      </Text>
                      {p.slots.map((t) => (
                        <View key={t} style={{ paddingHorizontal: space[2], paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.surface.sunken }}>
                          <Text variant="labelSm">{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
    </BottomSheet>
  );
}
