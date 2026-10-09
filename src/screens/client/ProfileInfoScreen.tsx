import React from 'react';
import { Pressable, View } from 'react-native';
import { AppBar, BottomSheet, Button, Icon, InfoRow, Panel, ProfileAvatar, RowLink, Screen, Tag, Text, TextField, TINT, space, useTheme } from '../../design-system';
import { AVATAR_KEYS, defaultAvatar } from '../../data/staffAvatars';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { saveAvatar, savePhone as savePhoneCloud } from '../../services/auth';
import { cleanAddress, validPhone } from '../../services/idCard';

/** เลขบัตรประชาชน: แสดงแค่ 4 ตัวท้าย (ข้อมูลอ่อนไหว) */
const maskId = (id: string) => (id.length === 13 ? `x-xxxx-xxxxx-${id.slice(10, 12)}-${id.slice(12)}` : '-');

/**
 * ที่อยู่ตามบัตร → บรรทัดตามส่วนของที่อยู่: เลขที่ หมู่ ซอย ถนน / ตำบล(แขวง) อำเภอ(เขต) / จังหวัด
 * ที่อยู่จากบัตรมักติดกันเป็นสายยาว → แยกที่คำนำหน้าแต่ละส่วนก่อน แล้วจัดเป็นบรรทัด
 */
const addressLines = (a?: string): string[] => {
  if (!a) return ['-'];
  const KEY = /(หมู่ที่|หมู่|ม\.|ซอย|ซ\.|ถนน|ถ\.|ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)/;
  const parts = cleanAddress(a)
    .replace(new RegExp(`\\s*${KEY.source}\\s*`, 'g'), '\n$1')
    .split('\n')
    .map((x) => x.replace(/^(หมู่ที่|หมู่)(\d)/, '$1 $2').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const area = /^(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต)/;
  const prov = /^(จังหวัด|จ\.)/;
  const lines: string[][] = [[], [], []];
  for (const p of parts) {
    // ไม่มีคำว่าจังหวัด (เช่น "เขตคลองเตย กรุงเทพมหานคร") → ส่วนท้ายหลังชื่ออำเภอ/เขต = จังหวัด
    const m = /^((?:อำเภอ|อ\.|เขต)\S+)\s+(.+)$/.exec(p);
    if (m) {
      lines[1].push(m[1]);
      lines[2].push(m[2]);
      continue;
    }
    lines[prov.test(p) ? 2 : area.test(p) ? 1 : 0].push(p);
  }
  return lines.map((l) => l.join(' ')).filter(Boolean);
};

/**
 * ข้อมูลส่วนตัว
 * รูปโปรไฟล์ = แก้ได้ (เลือก avatar)
 * ตามบัตรประชาชน (ชื่อ เลขบัตร วันเกิด เพศ ที่อยู่) = ดูได้อย่างเดียว — ยืนยันตัวตนแล้วและคลินิกใช้ลงทะเบียนผู้ป่วย แก้ผ่านคลินิก
 * เบอร์โทร = แก้ได้ (คลินิกใช้ติดต่อ) · อีเมล = ใช้เข้าสู่ระบบ (ไม่แก้ในหน้านี้)
 */
export function ProfileInfoScreen() {
  const nav = useNav();
  const { account, setAccount, client, profile, log } = useJourney();
  const c = account?.idCard;
  const { colors } = useTheme();
  const [pickAvatar, setPickAvatar] = React.useState(false);
  const [editPhone, setEditPhone] = React.useState(false);
  const [phone, setPhone] = React.useState(c?.phone ?? '');
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const savePhone = async () => {
    const p = phone.replace(/\D/g, '');
    if (!validPhone(p)) return setErr('เบอร์โทรไม่ถูกต้อง');
    if (!account || !c) return;
    setSaving(true);
    try {
      if (account.userId) await savePhoneCloud(account.userId, p);
      setAccount({ ...account, idCard: { ...c, phone: p } });
      log('ผู้รับบริการ', 'แก้ไขเบอร์โทร');
      setEditPhone(false);
    } catch {
      setErr('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen header={<AppBar title="ข้อมูลส่วนตัว" onBack={() => nav.goBack()} />}>
      {/* รูปโปรไฟล์ (แตะ = เลือกรูป · คลินิกเห็นรูปเดียวกัน) */}
      <View style={{ alignItems: 'center', gap: space[2], paddingVertical: space[2] }}>
        <Pressable accessibilityRole="button" accessibilityLabel="เปลี่ยนรูปโปรไฟล์" onPress={() => setPickAvatar(true)} disabled={!account}>
          <ProfileAvatar sex={account?.sex ?? 'ชาย'} size={96} photo={account?.avatar} />
          {account ? (
            <View style={{ position: 'absolute', right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' }}>
              <Icon name="edit-2" size="xs" color="#FFFFFF" />
            </View>
          ) : null}
        </Pressable>
        <Text variant="titleLg">{client.name}</Text>
      </View>
      <Panel title="ตามบัตรประชาชน" right={account?.verified ? <Tag text="ยืนยันตัวตนแล้ว" tone="good" /> : undefined}>
        <View style={{ gap: space[3] }}>
          <InfoRow k="ชื่อ-นามสกุล" v={c ? `${c.title}${c.firstName} ${c.lastName}` : client.name} />
          <InfoRow k="เลขบัตรประชาชน" v={c ? maskId(c.citizenId) : '-'} />
          <InfoRow k="วันเกิด" v={`${c?.birthDate ?? account?.birthDate ?? '-'} · ${profile.age} ปี`} />
          <InfoRow k="เพศ" v={c?.sex || account?.sex || '-'} />
          {/* ที่อยู่: แถวเดียวกับหัวข้อ ชิดขวา · ขึ้นบรรทัดตามส่วนของที่อยู่ (เลขที่/หมู่/ซอย/ถนน → ตำบล/อำเภอ → จังหวัด) ไม่ตัดกลางชื่อ */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[3] }}>
            <Text variant="bodySm" tone="secondary">
              ที่อยู่
            </Text>
            <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
              {addressLines(c?.address).map((l) => (
                <Text key={l} variant="labelMd" style={{ textAlign: 'right' }}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Panel>
      <Panel title="ติดต่อ" flush>
        <RowLink icon="phone" tint={TINT.green} title="เบอร์โทร" sub={c?.phone || 'ยังไม่ได้ระบุ'} onPress={account ? () => (setPhone(c?.phone ?? ''), setErr(null), setEditPhone(true)) : undefined} />
        <RowLink icon="mail" tint={TINT.slate} title="อีเมล" sub={account?.email ? `${account.email} · ใช้เข้าสู่ระบบ` : '-'} last />
      </Panel>
      <Panel flush>
        <RowLink icon="clipboard" tint={TINT.slate} title="HN คลินิก" sub={client.hn} last />
      </Panel>
      <BottomSheet visible={pickAvatar} onClose={() => setPickAvatar(false)} title="เลือกรูปโปรไฟล์" subtitle="คลินิกเห็นรูปเดียวกันตอนคุณจองและมารับบริการ" heightRatio={0.75}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' }}>
          {AVATAR_KEYS.map((k) => {
            const value = `avatar:${k}`;
            const on = (account?.avatar ?? defaultAvatar(account?.sex)) === value;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`avatar ${k}`}
                onPress={() => {
                  if (!account) return;
                  setAccount({ ...account, avatar: value });
                  if (account.userId) void saveAvatar(account.userId, value).catch(() => undefined);
                  log('ผู้รับบริการ', 'เปลี่ยนรูปโปรไฟล์');
                  setPickAvatar(false);
                }}
                style={{ borderRadius: 40, borderWidth: 3, borderColor: on ? colors.brand.primary : 'transparent', padding: 2 }}
              >
                <ProfileAvatar size={64} photo={value} />
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
      <BottomSheet visible={editPhone} onClose={() => setEditPhone(false)} title="เบอร์โทร" heightRatio={0.45} footer={<Button label="บันทึก" loading={saving} disabled={saving} onPress={() => void savePhone()} />}>
        <TextField label="เบอร์โทรที่คลินิกใช้ติดต่อ" value={phone} onChangeText={(v) => (setPhone(v.replace(/[^\d-]/g, '').slice(0, 12)), setErr(null))} keyboardType="phone-pad" error={err ?? undefined} />
      </BottomSheet>
    </Screen>
  );
}
