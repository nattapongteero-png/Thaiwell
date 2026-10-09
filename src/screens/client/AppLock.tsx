import React from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button, Icon, Text, TextField, useTheme } from '../../design-system';
import { radius, space } from '../../design-system/tokens';
import { useJourney } from '../../state/JourneyContext';
import { LOCK_AFTER_MS, PIN_LENGTH, PIN_TRIES, biometricReady, biometricUnlock, checkPin, hasPin, lockSupported, setPin } from '../../services/appLock';
import { thaiError, verifyPassword } from '../../services/auth';

/**
 * ล็อกแอปทับทุกหน้า (บัญชีจริง · มือถือเท่านั้น)
 * ยังไม่มี PIN (เพิ่งเข้าสู่ระบบ) → บังคับตั้ง PIN 6 หลัก · เปิดแอป / กลับเข้าแอปหลังทิ้งไว้เกิน 5 นาที → Face ID หรือ PIN
 * ลืม PIN / ผิดครบ 5 ครั้ง → ยืนยันรหัสผ่านของบัญชี แล้วตั้ง PIN ใหม่ (ข้อมูลในเครื่องไม่หาย)
 */
type Mode = 'off' | 'setup' | 'confirm' | 'locked' | 'password';

export function AppLock() {
  const { account, entered } = useJourney();
  const uid = lockSupported && entered ? account?.userId : undefined;
  const [mode, setMode] = React.useState<Mode>('off');
  const [bio, setBio] = React.useState(false);
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

  // เข้าแอปด้วยบัญชีนี้ (เปิดแอป / เพิ่งเข้าสู่ระบบ) → มี PIN = ล็อก · ไม่มี = ตั้ง PIN
  React.useEffect(() => {
    if (!uid) return setMode('off');
    let alive = true;
    void hasPin(uid).then((has) => alive && setMode(has ? 'locked' : 'setup'));
    void biometricReady().then((b) => alive && setBio(b));
    return () => {
      alive = false;
    };
  }, [uid]);

  // ทิ้งแอปไว้เบื้องหลังเกิน 5 นาที → ล็อก
  React.useEffect(() => {
    if (!uid) return;
    let leftAt = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') leftAt = Date.now();
      else if (s === 'active' && leftAt && Date.now() - leftAt > LOCK_AFTER_MS && modeRef.current === 'off') setMode('locked');
      if (s === 'active') leftAt = 0;
    });
    return () => sub.remove();
  }, [uid]);

  if (!uid || mode === 'off') return null;
  return <LockScreen uid={uid} email={account?.email ?? ''} mode={mode} setMode={setMode} bio={bio} />;
}

function LockScreen({ uid, email, mode, setMode, bio }: { uid: string; email: string; mode: Exclude<Mode, 'off'>; setMode: (m: Mode) => void; bio: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [pin, setPinText] = React.useState('');
  const [first, setFirst] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [tries, setTries] = React.useState(0);
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const tryBio = React.useCallback(async () => {
    if (await biometricUnlock()) setMode('off');
  }, [setMode]);
  // หน้าล็อกขึ้นมา → สแกน Face ID ให้ทันที (ยกเลิก = ใส่ PIN)
  React.useEffect(() => {
    if (mode === 'locked' && bio) void tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === 'locked', bio]);

  const done = async (p: string) => {
    if (mode === 'setup') {
      setFirst(p);
      setPinText('');
      setError(null);
      return setMode('confirm');
    }
    if (mode === 'confirm') {
      if (p !== first) {
        setPinText('');
        setFirst('');
        setError('PIN ไม่ตรงกัน ตั้งใหม่อีกครั้ง');
        return setMode('setup');
      }
      await setPin(uid, p);
      setTries(0);
      setMode('off');
      // ขอสิทธิ์ใช้ Face ID ตั้งแต่ตอนตั้ง PIN (ครั้งถัดไปปลดล็อกได้เลย)
      if (bio) void biometricUnlock();
      return;
    }
    if (await checkPin(uid, p)) {
      setTries(0);
      setMode('off');
      return;
    }
    const n = tries + 1;
    setTries(n);
    setPinText('');
    if (n >= PIN_TRIES) {
      setError('ใส่ PIN ผิดหลายครั้ง เข้าสู่ระบบด้วยรหัสผ่าน');
      setMode('password');
    } else setError(`PIN ไม่ถูกต้อง เหลือ ${PIN_TRIES - n} ครั้ง`);
  };
  const press = (d: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPinText(next);
    if (next.length === PIN_LENGTH) setTimeout(() => void done(next), 120);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyPassword(email, password);
      setPassword('');
      setPinText('');
      setTries(0);
      setMode('setup');
    } catch (e) {
      setError(thaiError(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'setup' ? 'ตั้ง PIN 6 หลัก' : mode === 'confirm' ? 'ใส่ PIN อีกครั้ง' : mode === 'password' ? 'เข้าสู่ระบบด้วยรหัสผ่าน' : 'ใส่ PIN';
  const sub = mode === 'setup' ? 'ใช้ปลดล็อกแอปเพื่อปกป้องข้อมูลสุขภาพ' : mode === 'password' ? email : undefined;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: colors.surface.canvas }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: mode === 'password' ? undefined : 'center', paddingTop: insets.top + (mode === 'password' ? space[10] : space[4]), paddingBottom: insets.bottom + space[4], paddingHorizontal: space[5] }}>
        <View style={{ alignItems: 'center', gap: space[2] }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.default, borderWidth: 1, borderColor: colors.border.subtle }}>
            <Icon name="lock" color={colors.text.primary} />
          </View>
          <Text variant="titleLg" align="center">
            {title}
          </Text>
          {sub ? (
            <Text variant="bodySm" tone="secondary" align="center">
              {sub}
            </Text>
          ) : null}
        </View>

        {mode === 'password' ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: space[4] }}>
            <TextField label="รหัสผ่าน" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="password" iconLeft="lock" error={error ?? undefined} />
            <Button label="ยืนยัน" loading={busy} disabled={password.length < 6 || busy} onPress={() => void verify()} />
            <Button label="กลับไปใส่ PIN" variant="ghost" onPress={() => { setError(null); setMode('locked'); }} />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space[4], marginTop: space[8] }}>
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <View key={i} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.text.primary, backgroundColor: i < pin.length ? colors.text.primary : 'transparent' }} />
              ))}
            </View>
            {/* หัว · จุด PIN · ปุ่มตัวเลข อยู่กลางจอเป็นกลุ่มเดียว (ไม่ดันปุ่มลงชิดล่าง) */}
            <Text variant="bodySm" align="center" color={colors.status.danger.solid} style={{ marginTop: space[3], marginBottom: space[4], minHeight: 22 }}>
              {error ?? ''}
            </Text>
            <Keypad
              onDigit={press}
              onDelete={() => setPinText((p) => p.slice(0, -1))}
              left={mode === 'locked' && bio ? { label: 'ใช้ Face ID', icon: <FaceIdGlyph color={colors.text.primary} />, onPress: () => void tryBio() } : undefined}
            />
            {/* เว้นที่ไว้เท่ากันทุกขั้น → ตอนตั้ง PIN กับปลดล็อก ตำแหน่งปุ่มไม่ขยับ */}
            <Pressable
              accessibilityRole="button"
              disabled={mode !== 'locked'}
              onPress={() => { setError(null); setMode('password'); }}
              style={{ alignSelf: 'center', padding: space[3], marginTop: space[2], opacity: mode === 'locked' ? 1 : 0 }}
            >
              <Text variant="labelMd" tone="secondary">
                ลืม PIN?
              </Text>
            </Pressable>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Keypad({ onDigit, onDelete, left }: { onDigit: (d: string) => void; onDelete: () => void; left?: { label: string; icon: React.ReactNode; onPress: () => void } }) {
  const { colors } = useTheme();
  const key = (content: React.ReactNode, onPress: (() => void) | undefined, label: string, plain?: boolean) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ width: 76, height: 76, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: plain ? 'transparent' : pressed ? colors.border.subtle : colors.surface.default })}
    >
      {content}
    </Pressable>
  );
  const digit = (d: string) => key(<Text style={{ fontSize: 28, lineHeight: 36 }}>{d}</Text>, () => onDigit(d), d);
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
  return (
    <View style={{ gap: space[3], alignItems: 'center' }}>
      {rows.map((r) => (
        <View key={r.join()} style={{ flexDirection: 'row', gap: space[6] }}>
          {r.map(digit)}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: space[6] }}>
        {left ? key(left.icon, left.onPress, left.label, true) : key(null, undefined, 'ว่าง', true)}
        {digit('0')}
        {key(<Icon name="delete" color={colors.text.primary} />, onDelete, 'ลบ', true)}
      </View>
    </View>
  );
}

/** สัญลักษณ์ Face ID (กรอบสี่มุม + หน้ายิ้ม) */
function FaceIdGlyph({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
      <Path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.6 1.2 4.4 1.2 6 0" />
    </Svg>
  );
}
