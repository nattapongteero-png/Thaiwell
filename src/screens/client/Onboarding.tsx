import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  HStack,
  Icon,
  Placeholder,
  Screen,
  Text,
  VStack,
  useTheme,
  type IconName,
  Panel,
  Tag,
} from '../../design-system';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';
import { saveConsents } from '../../services/auth';

/* ============================================================ 02 CONSENT */

export function ConsentScreen({ route }: { route?: { params?: { from?: 'signup' } } }) {
  const nav = useNav();
  const fromSignup = route?.params?.from === 'signup';
  const { consents, setConsents, log, account } = useJourney();
  const ready = consents.service && consents.aiProcessing;
  return (
    <Screen
      header={<AppBar title="ความยินยอมและความเป็นส่วนตัว" onBack={() => nav.goBack()} />}
      footer={
        <>
          <Button
            label={ready ? 'ยินยอมและดำเนินการต่อ' : 'โปรดยอมรับข้อที่จำเป็น (2 ข้อ)'}
            disabled={!ready}
            onPress={() => {
              log('ผู้รับบริการ', 'ให้ความยินยอม (บริการ, AI' + (consents.followUp ? ', ติดตามผล' : '') + (consents.research ? ', วิจัย' : '') + ')');
              // บัญชีจริง → เก็บความยินยอมกับบัญชี (เข้าเครื่องอื่นไม่ต้องถามซ้ำ)
              if (account?.userId) void saveConsents(consents).catch(() => undefined);
              // มาจากการสมัคร → เข้าหน้าแรกแบบเริ่มต้นใช้งาน (ย้อนกลับไปหน้าสมัครไม่ได้)
              if (fromSignup) nav.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
              else nav.replace('Interview');
            }}
          />
          <Text variant="labelSm" tone="tertiary" align="center">
            เปลี่ยนแปลงหรือถอนความยินยอมได้ตลอดเวลาที่ “โปรไฟล์ › ความเป็นส่วนตัว”
          </Text>
        </>
      }
    >
      <Text variant="bodyMd" tone="secondary">
        เราใช้ข้อมูลของคุณเท่าที่จำเป็นเพื่อความปลอดภัยในการนวด เลือกได้ว่าจะอนุญาตเรื่องใดบ้าง
      </Text>

      <Panel title="จำเป็นสำหรับการรับบริการ" right={<Tag text="จำเป็น" />}>
        <Checkbox
          label="ใช้ข้อมูลสุขภาพเพื่อคัดกรองและให้บริการ"
          description="อาการ โรคประจำตัว ยา — ผู้ให้บริการที่ดูแลคุณเท่านั้นที่เห็น"
          checked={consents.service}
          onChange={(v) => setConsents({ ...consents, service: v })}
        />
        <Divider />
        <Checkbox
          label="ให้ AI ช่วยซักประวัติและสรุปข้อมูล"
          description="AI เป็นผู้ช่วยเท่านั้น ไม่วินิจฉัยโรค ผู้ให้บริการเป็นผู้ตัดสินใจ"
          checked={consents.aiProcessing}
          onChange={(v) => setConsents({ ...consents, aiProcessing: v })}
        />
      </Panel>

      <Panel title="เลือกได้ตามต้องการ" right={<Tag text="ไม่บังคับ" />}>
        <Checkbox
          label="ติดตามอาการหลังรับบริการ"
          description="แจ้งเตือนผ่าน MyAtlas หลังนวด 1, 3 และ 7 วัน"
          checked={consents.followUp}
          onChange={(v) => setConsents({ ...consents, followUp: v })}
        />
        <Divider />
        <Checkbox
          label="ใช้ข้อมูลแบบไม่ระบุตัวตนเพื่อการวิจัย"
          description="ช่วยพัฒนาองค์ความรู้การแพทย์แผนไทย"
          checked={consents.research}
          onChange={(v) => setConsents({ ...consents, research: v })}
        />
      </Panel>

      <Button label="อ่านนโยบายฉบับเต็ม" variant="ghost" iconRight="external-link" fullWidth={false} />

    </Screen>
  );
}
