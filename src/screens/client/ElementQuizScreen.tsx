import React from 'react';
import { View } from 'react-native';
import {
  AppBar,
  Button,
  Card,
  ChipSection,
  ElementSummary,
  HStack,
  ProgressBar,
  Screen,
  SectionHeader,
  Text,
  VStack,
  radius,
  space,
  useTheme,
  Panel,
  ReplyChips,
} from '../../design-system';
import {
  ELEMENT_INFO,
  ELEMENT_PRINCIPLE,
  ELEMENT_QUIZ,
  dominantElement,
  elementPercents,
  type ElementKey,
} from '../../data/thaiMassageKnowledge';
import { useJourney } from '../../state/JourneyContext';
import { useNav } from '../../navigation/types';

const ORDER: ElementKey[] = ['ดิน', 'น้ำ', 'ลม', 'ไฟ'];

/**
 * ธาตุเจ้าเรือน: ผลของคุณ (ลักษณะ · แนวโน้มโรค · อาหาร) + แบบประเมิน 14 ข้อ (CPG_PCU หน้า 163–164)
 * ยังไม่เคยทำ → อธิบายว่าธาตุเจ้าเรือนคืออะไร แล้วชวนตอบ · ลักษณะของธาตุ = คำตอบของธาตุนั้นในแบบประเมิน
 */
export function ElementQuizScreen() {
  const nav = useNav();
  const { colors } = useTheme();
  const { elements, setElements, log, newPatient, elementsDone } = useJourney();
  // คนใหม่ที่ยังไม่เคยทำ → ไม่มี "ผลที่บันทึกไว้" (ไม่แสดงค่าตัวอย่าง)
  const hasSaved = elementsDone || !newPatient;
  const [answers, setAnswers] = React.useState<(ElementKey | undefined)[]>(Array(ELEMENT_QUIZ.length).fill(undefined));
  const answered = answers.filter(Boolean).length;
  const done = answered === ELEMENT_QUIZ.length;
  const pct = done ? elementPercents(answers) : elements;
  const top = dominantElement(pct);
  const info = ELEMENT_INFO[top];

  return (
    <Screen
      header={<AppBar title="ธาตุเจ้าเรือน" onBack={() => nav.goBack()} />}
      footer={
        <Button
          label={done ? 'บันทึกผลธาตุเจ้าเรือน' : `ตอบแล้ว ${answered}/${ELEMENT_QUIZ.length} ข้อ`}
          disabled={!done}
          onPress={() => {
            setElements(pct);
            log('ผู้รับบริการ', `ประเมินธาตุเจ้าเรือนปัจจุบัน: ${info.label} ${pct[top]}%`);
            nav.goBack();
          }}
        />
      }
    >
      {done || hasSaved ? (
        <Panel title={done ? 'ผลประเมินล่าสุด' : 'ธาตุของคุณ'}>
          <ElementSummary percent={pct[top]} name={info.label} advice={info.advice} />
          <VStack gap={2}>
            {ORDER.map((k) => (
              <HStack key={k} gap={2}>
                <Text variant="bodyXs" style={{ width: 56 }}>
                  ธาตุ{k}
                </Text>
                <View style={{ flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}>
                  <View style={{ width: `${pct[k]}%`, height: '100%', borderRadius: radius.full, backgroundColor: k === top ? colors.brand.primary : colors.border.default }} />
                </View>
                <Text variant="bodyXs" tone="secondary" style={{ width: 36, textAlign: 'right' }}>
                  {pct[k]}%
                </Text>
              </HStack>
            ))}
          </VStack>
        </Panel>
      ) : (
        <Panel title="ธาตุเจ้าเรือนคืออะไร">
          <Text variant="bodySm">{ELEMENT_PRINCIPLE.replace(' · ', ' ')}</Text>
          <Text variant="bodySm" tone="secondary">
            ตอบ 14 ข้อด้านล่าง เพื่อรู้ว่าธาตุไหนเด่นในตัวคุณ
          </Text>
        </Panel>
      )}
      {done || hasSaved ? (
        <>
          {/* ลักษณะของคนธาตุนี้ = คำตอบของธาตุนั้นในแบบประเมิน */}
          <Panel title={`ลักษณะของคน${info.label.replace(/ \(.*\)/, '')}`}>
            <VStack gap={2}>
              {ELEMENT_QUIZ.slice(0, 8).map((q) => (
                <HStack key={q.topic} gap={3} align="flex-start">
                  <Text variant="bodySm" tone="secondary" style={{ width: 92 }}>
                    {q.topic}
                  </Text>
                  <Text variant="bodySm" style={{ flex: 1 }}>
                    {q.options[top]}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Panel>
          <Panel title="ควรระวัง">
            <Text variant="bodySm">{info.tendency}</Text>
          </Panel>
          {info.foods ? (
            <Panel title="อาหารที่ช่วยปรับสมดุล">
              <Text variant="bodySm">{info.foods}</Text>
            </Panel>
          ) : null}
          <SectionHeader title="ประเมินอีกครั้ง" />
        </>
      ) : (
        <SectionHeader title="แบบประเมิน 14 ข้อ" />
      )}

      {/* 14 ข้อ ข้อละ 1 คำตอบ · ความคืบหน้าบอกที่ปุ่มด้านล่าง */}
      <ProgressBar value={answered / ELEMENT_QUIZ.length} />
      {ELEMENT_QUIZ.map((q, i) => {
        const labels = ORDER.map((k) => q.options[k]);
        const current = answers[i] ? q.options[answers[i]!] : undefined;
        return (
          <Panel key={q.topic} title={`${i + 1}. ${q.topic}`}>
            <ReplyChips
              options={labels}
              selected={current}
              onPick={(picked) => {
                const key = ORDER.find((k) => q.options[k] === picked);
                const next = [...answers];
                next[i] = key;
                setAnswers(next);
              }}
            />
          </Panel>
        );
      })}
    </Screen>
  );
}
