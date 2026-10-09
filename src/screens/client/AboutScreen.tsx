import React from 'react';
import { Linking } from 'react-native';
import { AppBar, Panel, RowLink, Screen, TINT } from '../../design-system';
import { useNav } from '../../navigation/types';
import app from '../../../app.json';

/**
 * เกี่ยวกับแอป: เวอร์ชัน + เครดิตของชุดไอคอน/ฟอนต์ที่ใช้
 * Solar Icons ใช้สัญญาอนุญาต CC BY 4.0 → ต้องแสดงชื่อผู้สร้าง ชื่อสัญญาอนุญาต และบอกว่ามีการแก้ไข (ปรับความหนาเส้น)
 */
const CREDITS: { title: string; sub: string; url: string }[] = [
  { title: 'Solar Icons โดย 480 Design', sub: 'CC BY 4.0 · ปรับความหนาเส้นและทำภาพเคลื่อนไหว', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { title: 'Lucide Icons', sub: 'ISC License', url: 'https://lucide.dev/license' },
  { title: 'IBM Plex Sans Thai', sub: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
];

export function AboutScreen() {
  const nav = useNav();
  return (
    <Screen header={<AppBar title="เกี่ยวกับแอป" onBack={() => nav.goBack()} />}>
      <Panel flush>
        <RowLink icon="info" tint={TINT.slate} title="ThaiWell AI" sub={`เวอร์ชัน ${app.expo.version}`} last />
      </Panel>
      <Panel title="เครดิต" flush>
        {CREDITS.map((c, i) => (
          <RowLink key={c.title} icon="external-link" tint={TINT.slate} title={c.title} sub={c.sub} last={i === CREDITS.length - 1} onPress={() => void Linking.openURL(c.url)} />
        ))}
      </Panel>
    </Screen>
  );
}
