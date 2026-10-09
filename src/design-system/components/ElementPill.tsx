import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fontFamily } from '../tokens';
import { Text } from './Text';

/**
 * ElementPill — pill ธาตุเจ้าเรือน ตามแบบ ThaiWell back-office (b3__el บนหน้าหุ่น 3D)
 * พื้นขาวโปร่ง · วงกลมสีธาตุ + ไอคอน (ดิน = ภูเขา · น้ำ = หยดน้ำ · ลม = ลม · ไฟ = เปลวไฟ — lucide, ISC)
 * ชื่อธาตุสีธาตุบรรทัดเดียว (ป้าย เช่น ธาตุเจ้าเรือน อ่านทาง screen reader)
 */
export type ThaiElement = 'ดิน' | 'น้ำ' | 'ลม' | 'ไฟ';

/** สีธาตุ (ELEMENT_INFO ของ back-office) */
export const ELEMENT_COLOR: Record<ThaiElement, string> = {
  ดิน: '#8A5A2B',
  น้ำ: '#2F6FA3',
  ลม: '#5F7F86',
  ไฟ: '#C2482B',
};

const ICON: Record<ThaiElement, string[]> = {
  ไฟ: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  ดิน: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  น้ำ: ['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z'],
  ลม: ['M12.8 19.6A2 2 0 1 0 14 16H2', 'M17.5 8a2.5 2.5 0 1 1 2 4H2', 'M9.8 4.4A2 2 0 1 1 11 8H2'],
};

export function ElementIcon({ element, size = 15, color = '#FFFFFF' }: { element: ThaiElement; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {ICON[element].map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}

/** ยังไม่รู้ธาตุ (ยังไม่ได้ทำแบบประเมิน) → สีกลาง · ไอคอน + · "ประเมินธาตุ" */
const ASK_COLOR = '#5B6B60';

export function ElementPill({ element, label = 'ธาตุเจ้าเรือน', onPress }: { element: ThaiElement | null; label?: string; onPress?: () => void }) {
  const c = element ? ELEMENT_COLOR[element] : ASK_COLOR;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={element ? `${label} ธาตุ${element}` : 'ประเมินธาตุเจ้าเรือน'}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        height: 30,
        paddingLeft: 3,
        paddingRight: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        borderColor: 'rgba(47,64,52,0.06)',
        shadowColor: '#000000',
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c,
          shadowColor: c,
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {element ? (
          <ElementIcon element={element} size={13} />
        ) : (
          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
        )}
      </View>
      {/* บรรทัดเดียว (ไม่เด่นกว่าแท็บ) · ไทยมีสระบน/ล่าง → lineHeight ~1.5 เท่า ไม่ให้ถูกตัด · ป้ายเต็มอ่านได้ทาง screen reader */}
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 18, color: c }}>{element ? `ธาตุ${element}` : 'ประเมินธาตุ'}</Text>
    </Pressable>
  );
}
