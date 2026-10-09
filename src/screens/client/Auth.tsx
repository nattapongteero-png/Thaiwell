import React from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { AppBar, Banner, Button, Panel, Tag, Icon, Screen, SegmentedControl, Text, TextField, VStack, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { baseProfile, useJourney } from '../../state/JourneyContext';
import { currentUser, saveIdentity, signIn, signUp, thaiError, type CloudUser } from '../../services/auth';
import { EMPTY_ID, TITLES, ageFromBirth, formatCitizenId, parseIdCard, sexOfTitle, validCitizenId, validPhone, type IdCard } from '../../services/idCard';
import { ocrAvailable, recognizeText } from '../../../modules/id-card-ocr';
import { useNav } from '../../navigation/types';

/* ============================================================ เข้าสู่ระบบ + สมัครบัญชี (จริง)
 * อีเมล + รหัสผ่าน (Supabase Auth) → ยืนยันตัวตนด้วยบัตรประชาชน (ถ่ายรูป/เลือกรูป → อ่านบนเครื่อง หรือกรอกเอง)
 * → ความยินยอม → ใช้งาน · ข้อมูลตัวตน/ความยินยอมเก็บกับบัญชี เข้าเครื่องไหนก็ได้ข้อมูลเดิม
 * ข้อมูลสุขภาพ (โรค ยา แพ้) ไม่ถามในขั้นนี้ — AI ถามระหว่างเล่าอาการแล้วบันทึกลงโปรไฟล์
 */

/** ภาพห้องนวด — จาก ThaiWell back-office (หน้า login) */
const SPA_ROOM = require('../../../assets/backdrop/spa-room.jpg');
/** แก้วฝ้า: เว็บเบลอจริง · native ใช้พื้นโปร่งอย่างเดียว */
const FROST: ViewStyle | null = Platform.OS === 'web' ? ({ backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)' } as ViewStyle) : null;


/** บัญชีที่ยืนยันตัวตนแล้ว → ข้อมูลในแอป (ชื่อ เพศ อายุ ความยินยอม) แล้วไปหน้าถัดไป */
function useEnterApp() {
  const nav = useNav();
  const { signOut, setAccount, setNewPatient, setProfile, setConsents } = useJourney();
  return (u: CloudUser) => {
    if (!u.identity) {
      nav.reset({ index: 0, routes: [{ name: 'Identity' }] });
      return;
    }
    const c = u.identity;
    const [dd, mm, yyyy] = c.birthDate.split('/').map(Number);
    signOut(true);
    setAccount({ provider: 'email', name: `${c.firstName} ${c.lastName}`, birthDate: `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy > 2400 ? yyyy - 543 : yyyy}`, sex: c.sex || 'ไม่ระบุ', verified: true, userId: u.id, email: u.email, idCard: c, avatar: u.avatar });
    setNewPatient(true);
    // เริ่มจากข้อมูลตั้งต้น ไม่ใช่ของบัญชีก่อนหน้า (ตั้งครรภ์/ผ่าตัด ฯลฯ ของคนก่อนเคยติดมา)
    setProfile({ ...baseProfile, age: ageFromBirth(c.birthDate) ?? baseProfile.age, conditions: [], medications: [], allergies: [], healthKnown: false, conditionsKnown: false, medicationsKnown: false, allergiesKnown: false, bp: undefined, temperature: undefined, pulse: undefined });
    if (u.consents) {
      setConsents(u.consents);
      nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
    } else nav.reset({ index: 0, routes: [{ name: 'Consent', params: { from: 'signup' } }] });
  };
}

/** หน้าเข้าสู่ระบบ / สมัครบัญชี (อีเมล + รหัสผ่าน) */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const enter = useEnterApp();
  const [mode, setMode] = React.useState<'เข้าสู่ระบบ' | 'สมัครบัญชี'>('เข้าสู่ระบบ');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const signup = mode === 'สมัครบัญชี';

  const nav = useNav();
  const { resumed, account } = useJourney();
  /** บัญชีเดิมในเครื่องแต่การเข้าสู่ระบบหลุด → เข้าใหม่แล้วกลับหน้าแรกพร้อมข้อมูลเดิม (ไม่ล้าง) */
  const [relogin, setRelogin] = React.useState(false);
  const home = () => nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
  // เข้าสู่ระบบค้างไว้ในเครื่อง → เข้าแอปเลย · มีข้อมูลในแอปที่จำไว้ → กลับหน้าแรกพร้อมข้อมูลเดิม (ไม่ล้าง)
  React.useEffect(() => {
    if (resumed) {
      // บัญชีจริง: ต้องยังเข้าสู่ระบบอยู่ (ไม่งั้นอ่านข้อมูลคลินิก/นัดจากหลังบ้านไม่ได้เลย)
      if (!account?.userId) return home();
      void currentUser()
        .then((u) => {
          if (u?.id === account.userId) return home();
          setEmail(account.email ?? '');
          setRelogin(true);
          setError('การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
        })
        .catch(() => home())
        .finally(() => setChecking(false));
      return;
    }
    void currentUser()
      .then((u) => (u ? enter(u) : undefined))
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const ready = emailOk && password.length >= 6 && (!signup || confirm === password);
  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (signup) {
        const r = await signUp(email, password);
        if (r.needsConfirm) setSent(true);
        else if (r.user) enter(r.user);
      } else {
        const u = await signIn(email, password);
        // บัญชีเดิม → กลับหน้าแรกพร้อมข้อมูลในเครื่อง · คนอื่น → เริ่มใหม่ตามปกติ
        if (relogin && u.id === account?.userId) home();
        else enter(u);
      }
    } catch (e) {
      setError(thaiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A120B' }}>
      <Image source={SPA_ROOM} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
        <Defs>
          <SvgGradient id="loginShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A120B" stopOpacity={0.15} />
            <Stop offset="0.3" stopColor="#1A120B" stopOpacity={0.3} />
            <Stop offset="0.55" stopColor="#1A120B" stopOpacity={0.8} />
            <Stop offset="1" stopColor="#1A120B" stopOpacity={0.95} />
          </SvgGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill="url(#loginShade)" />
      </Svg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingTop: insets.top + space[4], paddingBottom: insets.bottom + space[4], paddingHorizontal: space[5] }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: space[2], paddingBottom: space[5] }}>
            <Text variant="displayMd" color="#FFFFFF">
              ThaiWell AI
            </Text>
            <Text variant="bodyMd" color="rgba(255,255,255,0.82)">
              นวดแผนไทยที่เข้าใจร่างกายคุณ เล่าอาการกับ AI ก่อนมา ผู้ให้บริการรู้ล่วงหน้าว่าต้องดูแลตรงไหน
            </Text>
          </View>
          {checking ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginBottom: space[8] }} />
          ) : sent ? (
            <View style={[{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' }, FROST]}>
              <Icon name="mail" color="#FFFFFF" />
              <Text variant="titleSm" color="#FFFFFF">
                ส่งลิงก์ยืนยันไปที่ {email.trim()} แล้ว
              </Text>
              <Text variant="bodySm" color="rgba(255,255,255,0.8)">
                เปิดลิงก์ในอีเมลเพื่อยืนยัน แล้วกลับมาเข้าสู่ระบบ
              </Text>
              <Button
                label="ไปหน้าเข้าสู่ระบบ"
                onPress={() => {
                  setSent(false);
                  setMode('เข้าสู่ระบบ');
                }}
              />
            </View>
          ) : (
            <View style={[{ gap: space[3], padding: space[4], borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.94)' }, FROST]}>
              <SegmentedControl
                options={['เข้าสู่ระบบ', 'สมัครบัญชี']}
                value={mode}
                onChange={(v) => {
                  setMode(v as typeof mode);
                  setError(null);
                }}
              />
              <TextField label="อีเมล" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" iconLeft="mail" />
              <TextField label="รหัสผ่าน" value={password} onChangeText={setPassword} placeholder="อย่างน้อย 6 ตัวอักษร" secureTextEntry autoCapitalize="none" textContentType={signup ? 'newPassword' : 'password'} iconLeft="lock" />
              {signup ? (
                <TextField label="ยืนยันรหัสผ่าน" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" textContentType="newPassword" iconLeft="lock" error={confirm && confirm !== password ? 'รหัสผ่านไม่ตรงกัน' : undefined} />
              ) : null}
              {error ? (
                <Text variant="bodySm" color="#B42318" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <Button label={signup ? 'สมัครบัญชี' : 'เข้าสู่ระบบ'} disabled={!ready || busy} loading={busy} onPress={submit} />
              <Text variant="caption" tone="secondary" align="center">
                {signup ? 'สมัครแล้วยืนยันตัวตนด้วยบัตรประชาชน · ' : ''}เข้าใช้งานถือว่ายอมรับข้อกำหนดการใช้งาน
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ============================================================ ยืนยันตัวตนด้วยบัตรประชาชน
 * ถ่ายรูป/เลือกรูปบัตร → อ่านข้อความบนเครื่อง (Apple Vision · รูปไม่ถูกส่งออกไป) → เติมช่องให้ → ผู้ใช้ตรวจ/แก้ แล้วยืนยัน
 * หรือกรอกเองทั้งหมด · เลขบัตรตรวจหลักตรวจสอบ · เบอร์โทรใช้ติดต่อเรื่องนัด
 */
export function IdentityScreen() {
  const { colors } = useTheme();
  const enter = useEnterApp();
  const [card, setCard] = React.useState<IdCard>(EMPTY_ID);
  const [method, setMethod] = React.useState<'scan' | 'manual'>('manual');
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof IdCard) => (v: string) => setCard((c) => ({ ...c, [k]: v }));

  const read = async (fromCamera: boolean) => {
    setNote(null);
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setNote(fromCamera ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดได้ที่ การตั้งค่า › ThaiWell AI' : 'ไม่ได้รับอนุญาตให้เข้าถึงรูปภาพ');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
    const r = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets[0]) return;
    setPhoto(r.assets[0].uri);
    setReading(true);
    try {
      const lines = await recognizeText(r.assets[0].uri);
      const got = lines ? parseIdCard(lines) : {};
      const n = Object.keys(got).length;
      setCard((c) => ({ ...c, ...got }));
      setMethod('scan');
      setNote(n ? `อ่านจากบัตรได้ ${n} ช่อง ตรวจให้ถูกต้องอีกครั้ง แล้วกรอกส่วนที่ขาด` : 'อ่านข้อมูลจากรูปไม่ได้ ลองถ่ายใหม่ให้บัตรเต็มกรอบและไม่สะท้อนแสง หรือกรอกเอง');
    } catch {
      setNote('อ่านข้อมูลจากรูปไม่ได้ ลองถ่ายใหม่ หรือกรอกเอง');
    } finally {
      setReading(false);
    }
  };

  const idOk = validCitizenId(card.citizenId);
  const age = ageFromBirth(card.birthDate);
  const phoneOk = validPhone(card.phone);
  const ready = idOk && !!card.title && card.firstName.trim().length > 0 && card.lastName.trim().length > 0 && !!card.sex && age !== null && card.address.trim().length > 8 && phoneOk;
  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const identity = { ...card, citizenId: card.citizenId.replace(/\D/g, ''), phone: card.phone.replace(/\D/g, ''), firstName: card.firstName.trim(), lastName: card.lastName.trim(), address: card.address.trim(), verifiedAt: new Date().toISOString(), method };
      const u = await saveIdentity(identity);
      if (u) enter(u);
    } catch (e) {
      setError(thaiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={<AppBar eyebrow="ขั้นตอนที่ 1 จาก 2" title="ยืนยันตัวตน" />} footer={<Button label={ready ? 'ยืนยันข้อมูล' : 'กรอกข้อมูลให้ครบ'} disabled={!ready || saving} loading={saving} onPress={save} />}>
      <Text variant="bodyMd" tone="secondary">
        ใช้ข้อมูลตามบัตรประชาชน เพื่อให้คลินิกลงทะเบียนและดูแลคุณได้ถูกคน
      </Text>

      <Panel title="อ่านจากบัตรประชาชน" right={<Tag text="อ่านบนเครื่อง" tone="good" />}>
        {photo ? <Image source={{ uri: photo }} style={{ width: '100%', aspectRatio: 1.58, borderRadius: radius.md }} resizeMode="cover" accessibilityLabel="รูปบัตรประชาชน" /> : null}
        {reading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <ActivityIndicator color={colors.brand.primary} />
            <Text variant="bodySm">กำลังอ่านข้อมูลจากบัตร…</Text>
          </View>
        ) : null}
        {ocrAvailable ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Button label="ถ่ายรูปบัตร" iconLeft="camera" size="md" onPress={() => void read(true)} disabled={reading} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="เลือกรูป" iconLeft="image" variant="secondary" size="md" onPress={() => void read(false)} disabled={reading} />
            </View>
          </View>
        ) : (
          <Text variant="bodySm" tone="secondary">
            อ่านรูปบัตรได้ในแอปบน iPhone · ที่นี่กรอกข้อมูลด้านล่างได้เลย
          </Text>
        )}
        <Text variant="caption" tone="tertiary">
          รูปบัตรอ่านในเครื่องนี้เท่านั้น ไม่ถูกส่งหรือเก็บไว้ · เก็บเฉพาะข้อมูลที่คุณยืนยัน
        </Text>
        {note ? <Text variant="bodySm" color={colors.brand.primary}>{note}</Text> : null}
      </Panel>

      <VStack gap={4}>
        <TextField
          label="เลขประจำตัวประชาชน"
          value={formatCitizenId(card.citizenId)}
          onChangeText={(v) => set('citizenId')(v.replace(/\D/g, '').slice(0, 13))}
          placeholder="x-xxxx-xxxxx-xx-x"
          keyboardType="number-pad"
          error={card.citizenId.length === 13 && !idOk ? 'เลขบัตรไม่ถูกต้อง ตรวจอีกครั้ง' : undefined}
        />
        <View style={{ gap: space[1] }}>
          <Text variant="labelMd">คำนำหน้า</Text>
          <SegmentedControl
            options={[...TITLES]}
            value={card.title}
            onChange={(t) => setCard((c) => ({ ...c, title: t, sex: sexOfTitle(t) || c.sex }))}
          />
        </View>
        <TextField label="ชื่อ" value={card.firstName} onChangeText={set('firstName')} placeholder="ชื่อจริงตามบัตร" />
        <TextField label="นามสกุล" value={card.lastName} onChangeText={set('lastName')} placeholder="นามสกุลตามบัตร" />
        <View style={{ gap: space[1] }}>
          <Text variant="labelMd">เพศ</Text>
          <SegmentedControl options={['ชาย', 'หญิง']} value={card.sex} onChange={(v) => set('sex')(v)} />
        </View>
        <TextField
          label="วันเดือนปีเกิด (พ.ศ.)"
          value={card.birthDate}
          onChangeText={set('birthDate')}
          placeholder="วว/ดด/ปปปป เช่น 12/03/2528"
          keyboardType="numbers-and-punctuation"
          error={card.birthDate.length >= 10 && age === null ? 'วันเกิดไม่ถูกต้อง' : undefined}
        />
        <TextField label="ที่อยู่ตามบัตรประชาชน" value={card.address} onChangeText={set('address')} placeholder="บ้านเลขที่ หมู่ ถนน ตำบล อำเภอ จังหวัด" multiline />
        <TextField
          label="เบอร์โทรศัพท์"
          value={card.phone}
          onChangeText={(v) => set('phone')(v.replace(/[^\d-]/g, '').slice(0, 12))}
          placeholder="08x-xxx-xxxx"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          error={card.phone.replace(/\D/g, '').length >= 9 && !phoneOk ? 'เบอร์โทรไม่ถูกต้อง' : undefined}
        />
      </VStack>
      {error ? <Banner tone="danger" title="บันทึกไม่สำเร็จ" message={error} /> : null}
    </Screen>
  );
}
