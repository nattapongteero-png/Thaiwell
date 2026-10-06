import React from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar, Button, InfoRow, Panel, Tag, Icon, Screen, SegmentedControl, Text, TextField, VStack, useTheme, type IconName } from '../../design-system';
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
    // Health ID ให้แค่ข้อมูลตัวตน: ชื่อ · เลขบัตร · วันเกิด · เพศ · เบอร์โทร · อีเมล (ไม่มีโรค/ยา → กรอกเอง)
    sex: 'หญิง',
    verified: true,
    got: [
      { field: 'ชื่อ-นามสกุล', value: 'สมหญิง ใจงาม' },
      { field: 'เลขบัตรประชาชน', value: '1-1037-xxxxx-xx-3' },
      { field: 'วันเกิด', value: '12 มี.ค. 2528' },
      { field: 'เพศ', value: 'หญิง' },
      { field: 'เบอร์โทร', value: '08x-xxx-4521' },
      { field: 'อีเมล', value: 'somying.j@gmail.com' },
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

/** ภาพห้องนวด — จาก ThaiWell back-office (หน้า login) */
const SPA_ROOM = require('../../../assets/backdrop/spa-room.jpg');
/** แก้วฝ้า: เว็บเบลอจริง · native ใช้พื้นโปร่งอย่างเดียว */
const FROST: ViewStyle | null = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)' } as ViewStyle) : null;

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
  const { signOut, setConsents } = useJourney();
  const [loading, setLoading] = React.useState<AuthProvider | null>(null);

  const signIn = (id: AuthProvider) => {
    setLoading(id);
    // จำลองหน้ายืนยันของผู้ให้บริการ login + ดึงข้อมูล
    setTimeout(() => {
      setLoading(null);
      nav.navigate('SignupInfo', { provider: id });
    }, 900);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A120B' }}>
      {/* ภาพห้องนวด (จาก ThaiWell back-office หน้า login) เต็มจอ + ไล่เงาเข้มด้านล่างให้อ่านตัวอักษรได้ */}
      <Image source={SPA_ROOM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
        <Defs>
          <SvgGradient id="loginShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A120B" stopOpacity={0.15} />
            <Stop offset="0.35" stopColor="#1A120B" stopOpacity={0.25} />
            <Stop offset="0.62" stopColor="#1A120B" stopOpacity={0.78} />
            <Stop offset="1" stopColor="#1A120B" stopOpacity={0.94} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill="url(#loginShade)" />
      </Svg>

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4], paddingHorizontal: space[5] }}>
        <View style={{ gap: space[2], paddingBottom: space[5] }}>
          <Text variant="displayMd" color="#FFFFFF">
            ThaiWell AI
          </Text>
          <Text variant="bodyMd" color="rgba(255,255,255,0.82)">
            นวดแผนไทยที่เข้าใจร่างกายคุณ เล่าอาการกับ AI ก่อนมา ผู้ให้บริการรู้ล่วงหน้าว่าต้องดูแลตรงไหน
          </Text>
        </View>

        <View style={{ gap: space[3] }}>
          {OPTIONS.map((o, i) => {
            const primary = i === 0;
            // ปุ่มหลัก = ขาวทึบ · ปุ่มรอง = แก้วฝ้าบนภาพ
            const fg = primary ? colors.text.primary : '#FFFFFF';
            return (
              <Pressable
                key={o.id}
                accessibilityRole="button"
                accessibilityLabel={o.title}
                disabled={!!loading}
                onPress={() => signIn(o.id)}
                style={({ pressed }) => [
                  {
                    minHeight: 56,
                    paddingHorizontal: space[4],
                    paddingVertical: space[3],
                    borderRadius: radius.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space[3],
                    backgroundColor: primary ? '#FFFFFF' : 'rgba(255,255,255,0.14)',
                    borderWidth: primary ? 0 : 1,
                    borderColor: 'rgba(255,255,255,0.32)',
                    opacity: pressed || (loading && loading !== o.id) ? 0.6 : 1,
                  },
                  primary ? null : FROST,
                ]}
              >
                <Icon name={o.icon} color={fg} />
                <View style={{ flex: 1 }}>
                  <Text variant="labelLg" color={fg}>
                    {o.title}
                  </Text>
                  {o.hint ? (
                    <Text variant="caption" color={primary ? colors.text.secondary : 'rgba(255,255,255,0.7)'}>
                      {o.hint}
                    </Text>
                  ) : null}
                </View>
                {loading === o.id ? <ActivityIndicator color={fg} /> : <Icon name="chevron-right" size="sm" color={primary ? colors.text.tertiary : 'rgba(255,255,255,0.7)'} />}
              </Pressable>
            );
          })}
          <Text variant="caption" color="rgba(255,255,255,0.6)" align="center">
            เข้าสู่ระบบถือว่ายอมรับข้อกำหนดการใช้งาน
          </Text>
          {/* ต้นแบบ: ข้ามไปดูคนไข้ที่มีประวัติการรักษาแล้ว */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // ล้างข้อมูลของรอบก่อนทั้งหมด (เช่น สมัครแล้วย้อนกลับมา) → คนไข้ตัวอย่างได้ข้อมูลตั้งต้นครบ · ยินยอมแล้วในเคสตัวอย่าง
              signOut();
              setConsents({ service: true, aiProcessing: true, followUp: true, research: false });
              nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
            }}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="labelLg" color="#FFFFFF">
              ดูตัวอย่างคนไข้เดิม (ข้าม)
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** หลังเข้าสู่ระบบ: แสดงสิ่งที่ได้มาแล้ว + ถามเฉพาะที่ขาด → ความยินยอม */
/** วว/ดด/ปปปป → วันที่จริง (รับ พ.ศ.) · null = ไม่ถูกต้อง */
function toBirthCE(text: string): { text: string; age: number } | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy > 2400) yyyy -= 543;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  const now = new Date();
  const age = now.getFullYear() - yyyy - (now.getMonth() < mm - 1 || (now.getMonth() === mm - 1 && now.getDate() < dd) ? 1 : 0);
  if (d > now || age < 1 || age > 120) return null;
  return { text: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`, age };
}

export function SignupInfoScreen({ route }: { route: { params: { provider: AuthProvider } } }) {
  const nav = useNav();
  const { colors } = useTheme();
  const { setAccount, setNewPatient, profile, setProfile } = useJourney();
  const d = PROVIDER_DATA[route.params.provider];
  const [name, setName] = React.useState(d.name);
  const [birth, setBirth] = React.useState(d.birthDate);
  const [sex, setSex] = React.useState(d.sex);
  const needName = !d.name;
  const needBirth = !d.birthDate;
  const needSex = !d.sex;
  const missing = needName || needBirth || needSex;
  // วันเกิดต้องเป็นวันที่จริงในอดีต (อายุ 1–120) · ปี พ.ศ. (> 2400) แปลงเป็น ค.ศ. ให้ (กันอายุติดลบ → กฎความปลอดภัยตามอายุไม่ทำงาน)
  const birthCE = toBirthCE(birth);
  const ready = name.trim().length > 1 && !!birthCE && !!sex;
  const birthError = birth.length >= 10 && !birthCE ? 'วันเกิดไม่ถูกต้อง' : undefined;

  const next = () => {
    if (!birthCE) return;
    setAccount({ provider: route.params.provider, name: name.trim(), birthDate: birthCE.text, sex, verified: d.verified });
    setNewPatient(true);
    // ผู้ใช้ใหม่: ยังไม่มีโรคประจำตัว/ยา/แพ้ (ไม่มีช่องทางไหนส่งมา) → กรอกเองตอนเล่าอาการกับ AI หรือในโปรไฟล์ · อายุคิดจากวันเกิด
    const age = birthCE.age;
    setProfile({ ...profile, age, conditions: [], medications: [], allergies: [], healthKnown: false, bp: undefined, temperature: undefined, pulse: undefined });
    nav.navigate('Consent', { from: 'signup' });
  };

  return (
    <Screen
      header={<AppBar title={missing ? 'ข้อมูลเพิ่มเติม' : 'ตรวจสอบข้อมูล'} onBack={() => nav.goBack()} />}
      footer={<Button label={ready ? 'ถัดไป: ความยินยอม' : 'กรอกข้อมูลให้ครบ'} disabled={!ready} onPress={next} />}
    >
      {/* ได้มาแล้วจากช่องทางที่เข้าสู่ระบบ (Panel ชุดเดียวกับหน้าอื่น) */}
      <Panel title={`ได้จาก ${d.label} แล้ว`} right={d.verified ? <Tag text="ยืนยันตัวตนแล้ว" tone="good" /> : undefined}>
        {d.got.map((g) => (
          <InfoRow key={g.field} k={g.field} v={g.value} />
        ))}
      </Panel>

      {/* ถามเฉพาะที่ขาด */}
      {missing ? (
        <VStack gap={4}>
          <View style={{ gap: 2 }}>
            <Text variant="titleSm">ขออีกนิด</Text>
            <Text variant="bodySm" tone="secondary">
              {needBirth ? 'อายุและเพศ' : 'เพศ'}ใช้คัดกรองข้อห้ามก่อนนวด
            </Text>
          </View>
          {needName ? <TextField label="ชื่อ-นามสกุล" value={name} onChangeText={setName} placeholder="ชื่อจริง ไม่ใช่ชื่อเล่น" /> : null}
          {needBirth ? <TextField label="วันเกิด" value={birth} onChangeText={setBirth} placeholder="วว/ดด/ปปปป" keyboardType="numbers-and-punctuation" error={birthError} /> : null}
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
