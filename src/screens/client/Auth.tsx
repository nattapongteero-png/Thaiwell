import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar, Body3D, Button, Card, Divider, Icon, Screen, SegmentedControl, Text, TextField, VStack, useTheme, type IconName } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney, type AuthProvider } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

/* ============================================================ เข้าสู่ระบบ + สมัคร
 * ช่องทางเข้าได้ข้อมูลไม่เท่ากัน → หลังเข้าสู่ระบบถามเฉพาะสิ่งที่ยังขาด
 * - Health ID: ตัวตนยืนยันแล้ว (+ อาจได้ประวัติสุขภาพ ตามสิทธิ์ API และความยินยอม) → ไม่ต้องกรอก
 * - Google: ชื่อ อีเมล → ถามวันเกิด เพศ
 * - LINE: ชื่อที่แสดง → ถามชื่อจริง วันเกิด เพศ
 * ข้อมูลสุขภาพที่ยังขาด (โรค ยา แพ้) ไม่ถามในขั้นนี้ — AI ถามระหว่างเล่าอาการแล้วบันทึกลงโปรไฟล์
 * ⚠️ ต้นแบบ: ข้อมูลที่แต่ละช่องทางส่งมาเป็นข้อมูลจำลอง (ขอบเขตจริงของ Health ID ต้องเช็กกับเอกสาร API)
 */

interface ProviderData {
  label: string;
  /** ข้อมูลที่ได้จากช่องทางนี้ (แสดงให้ผู้ใช้เห็นว่าได้อะไรมาแล้ว) */
  got: { field: string; value: string }[];
  /** ประวัติสุขภาพที่ได้มาด้วย (ถ้ามี) */
  health?: { field: string; value: string }[];
  name: string;
  birthDate: string;
  sex: string;
  verified: boolean;
}

export const PROVIDER_DATA: Record<AuthProvider, ProviderData> = {
  healthid: {
    label: 'Health ID',
    name: 'สมหญิง ใจงาม',
    birthDate: '12/03/1985',
    sex: 'หญิง',
    verified: true,
    got: [
      { field: 'ชื่อ-นามสกุล', value: 'สมหญิง ใจงาม' },
      { field: 'เลขบัตรประชาชน', value: '1-1037-xxxxx-xx-3' },
      { field: 'วันเกิด', value: '12 มี.ค. 2528' },
      { field: 'เพศ', value: 'หญิง' },
    ],
    health: [
      { field: 'โรคประจำตัว', value: 'ความดันโลหิตสูง' },
      { field: 'ยาที่ใช้ประจำ', value: 'Amlodipine 5 mg' },
    ],
  },
  google: {
    label: 'Google',
    name: 'Somying Jaingam',
    birthDate: '',
    sex: '',
    verified: false,
    got: [
      { field: 'ชื่อ', value: 'Somying Jaingam' },
      { field: 'อีเมล', value: 'somying.j@gmail.com' },
    ],
  },
  line: {
    label: 'LINE',
    name: '',
    birthDate: '',
    sex: '',
    verified: false,
    got: [{ field: 'ชื่อที่แสดงใน LINE', value: 'หญิง 🌸' }],
  },
};

const OPTIONS: { id: AuthProvider; title: string; hint?: string; icon: IconName }[] = [
  { id: 'healthid', title: 'เข้าสู่ระบบด้วย Health ID', hint: 'แนะนำ', icon: 'shield' },
  { id: 'google', title: 'ดำเนินการต่อด้วย Google', icon: 'mail' },
  { id: 'line', title: 'ดำเนินการต่อด้วย LINE', icon: 'message-circle' },
];

/** หน้าเข้าสู่ระบบ: Health ID เป็นทางหลัก · Google / LINE เป็นทางรอง */
export function AuthScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setAccount, setNewPatient } = useJourney();
  const [loading, setLoading] = React.useState<AuthProvider | null>(null);
  const [heroH, setHeroH] = React.useState(0);

  const signIn = (id: AuthProvider) => {
    setLoading(id);
    // จำลองหน้ายืนยันของผู้ให้บริการ login + ดึงข้อมูล
    setTimeout(() => {
      setLoading(null);
      nav.navigate('SignupInfo', { provider: id });
    }, 900);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface.canvas, paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4], paddingHorizontal: space[5] }}>
      {/* หุ่นเป็นภาพหลักของแอป — เห็นตั้งแต่แรกว่าแอปนี้เกี่ยวกับร่างกาย (หน้าแรกจะยังไม่มีหุ่นจนกว่าจะเริ่มประเมินอาการ) */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setHeroH(Math.round(e.nativeEvent.layout.height))}>
        {heroH > 0 ? <Body3D interactive={false} width={Math.round(heroH * (232 / 583))} height={heroH} restAngle={0} pins={[]} marks={[]} /> : null}
      </View>
      <View style={{ gap: space[2], paddingBottom: space[5] }}>
        <Text variant="displayMd">ThaiWell AI</Text>
        <Text variant="bodyMd" tone="secondary">
          นวดแผนไทยที่เข้าใจร่างกายคุณ เล่าอาการกับ AI ก่อนมา ผู้ให้บริการรู้ล่วงหน้าว่าต้องดูแลตรงไหน
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        {OPTIONS.map((o, i) => {
          const primary = i === 0;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              accessibilityLabel={o.title}
              disabled={!!loading}
              onPress={() => signIn(o.id)}
              style={({ pressed }) => ({
                minHeight: 56,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                borderRadius: radius.lg,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                backgroundColor: primary ? colors.text.primary : colors.surface.default,
                borderWidth: primary ? 0 : 1,
                borderColor: colors.border.default,
                opacity: pressed || (loading && loading !== o.id) ? 0.6 : 1,
              })}
            >
              <Icon name={o.icon} color={primary ? colors.text.inverse : colors.text.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="labelLg" color={primary ? colors.text.inverse : colors.text.primary}>
                  {o.title}
                </Text>
                {o.hint ? (
                  <Text variant="caption" color={primary ? 'rgba(255,255,255,0.7)' : colors.text.secondary}>
                    {o.hint}
                  </Text>
                ) : null}
              </View>
              {loading === o.id ? <ActivityIndicator color={primary ? colors.text.inverse : colors.text.primary} /> : <Icon name="chevron-right" size="sm" color={primary ? colors.text.inverse : colors.text.tertiary} />}
            </Pressable>
          );
        })}
        <Text variant="caption" tone="tertiary" align="center">
          เข้าสู่ระบบถือว่ายอมรับข้อกำหนดการใช้งาน
        </Text>
        {/* ต้นแบบ: ข้ามไปดูคนไข้ที่มีประวัติการรักษาแล้ว */}
        <Button
          label="ดูตัวอย่างคนไข้เดิม (ข้าม)"
          variant="ghost"
          onPress={() => {
            setAccount(null);
            setNewPatient(false);
            nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
          }}
        />
      </View>
    </View>
  );
}

/** หลังเข้าสู่ระบบ: แสดงสิ่งที่ได้มาแล้ว + ถามเฉพาะที่ขาด → ความยินยอม */
export function SignupInfoScreen({ route }: { route: { params: { provider: AuthProvider } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { setAccount, setNewPatient } = useJourney();
  const d = PROVIDER_DATA[route.params.provider];
  const [name, setName] = React.useState(d.name);
  const [birth, setBirth] = React.useState(d.birthDate);
  const [sex, setSex] = React.useState(d.sex);
  const needName = !d.name;
  const needBirth = !d.birthDate;
  const needSex = !d.sex;
  const missing = needName || needBirth || needSex;
  const ready = name.trim().length > 1 && /^\d{2}\/\d{2}\/\d{4}$/.test(birth) && !!sex;

  const next = () => {
    setAccount({ provider: route.params.provider, name: name.trim(), birthDate: birth, sex, verified: d.verified });
    setNewPatient(true);
    nav.navigate('Consent', { from: 'signup' });
  };

  return (
    <Screen
      header={<AppBar title={missing ? 'ข้อมูลเพิ่มเติม' : 'ตรวจสอบข้อมูล'} subtitle={`เข้าสู่ระบบด้วย ${d.label}`} onBack={() => nav.goBack()} />}
      footer={<Button label={ready ? 'ถัดไป: ความยินยอม' : 'กรอกข้อมูลให้ครบ'} disabled={!ready} onPress={next} />}
    >
      {/* ได้มาแล้วจากช่องทางที่เข้าสู่ระบบ */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Icon name="check-circle" size="sm" color={colors.brand.primary} />
          <Text variant="titleSm">ได้จาก {d.label} แล้ว</Text>
          {d.verified ? (
            <View style={{ marginLeft: 'auto', paddingHorizontal: space[2], height: 22, borderRadius: radius.full, backgroundColor: colors.brand.subtle, justifyContent: 'center' }}>
              <Text variant="caption" color={colors.brand.primary}>
                ยืนยันตัวตนแล้ว
              </Text>
            </View>
          ) : null}
        </View>
        <VStack gap={2}>
          {d.got.map((g) => (
            <View key={g.field} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
              <Text variant="bodySm" tone="secondary">
                {g.field}
              </Text>
              <Text variant="bodySm" style={{ flexShrink: 1, textAlign: 'right' }}>
                {g.value}
              </Text>
            </View>
          ))}
        </VStack>
        {d.health ? (
          <>
            <Divider />
            <Text variant="labelMd">ประวัติสุขภาพจากโรงพยาบาล</Text>
            <VStack gap={2}>
              {d.health.map((g) => (
                <View key={g.field} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
                  <Text variant="bodySm" tone="secondary">
                    {g.field}
                  </Text>
                  <Text variant="bodySm" style={{ flexShrink: 1, textAlign: 'right' }}>
                    {g.value}
                  </Text>
                </View>
              ))}
            </VStack>
          </>
        ) : null}
      </Card>

      {/* ถามเฉพาะที่ขาด */}
      {missing ? (
        <VStack gap={4}>
          <View style={{ gap: 2 }}>
            <Text variant="titleSm">ขออีกนิด</Text>
            <Text variant="bodySm" tone="secondary">
              อายุและเพศใช้คัดกรองข้อห้ามก่อนนวด
            </Text>
          </View>
          <TextField label="ชื่อ-นามสกุล" value={name} onChangeText={setName} placeholder={needName ? 'ชื่อจริง ไม่ใช่ชื่อเล่น' : undefined} />
          {needBirth ? <TextField label="วันเกิด" value={birth} onChangeText={setBirth} placeholder="วว/ดด/ปปปป (ค.ศ.)" keyboardType="numbers-and-punctuation" /> : null}
          {needSex ? (
            <View style={{ gap: space[1] }}>
              <Text variant="labelMd">เพศ</Text>
              <SegmentedControl options={['ชาย', 'หญิง', 'ไม่ระบุ']} value={sex} onChange={setSex} />
            </View>
          ) : null}
        </VStack>
      ) : null}

    </Screen>
  );
}
