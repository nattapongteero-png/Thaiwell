import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Icon, Text } from '../../design-system';
import { space } from '../../design-system/tokens';

/** ข้อความใน QR เช็กอินของคลินิก (ThaiWell back-office) */
export const parseCheckinQr = (text: string) => /^THAIWELL-CHECKIN:([A-Z0-9]{6})$/i.exec(text.trim())?.[1]?.toUpperCase() ?? null;

/**
 * สแกน QR เช็กอินที่เคาน์เตอร์ (กล้องหลัง) · เจอ QR ของคลินิก → ส่งรหัสกลับ · QR อื่น (เช่น พร้อมเพย์) → บอกว่าไม่ใช่
 * เว็บ/ไม่มีกล้อง → ไม่เปิด (ให้พิมพ์รหัสแทน)
 */
export function QrScanner({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const insets = useSafeAreaInsets();
  const [hint, setHint] = React.useState<string | null>(null);
  const [cam, setCam] = React.useState<typeof import('expo-camera') | null>(null);
  const [granted, setGranted] = React.useState<boolean | null>(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    if (!open || Platform.OS === 'web') return;
    done.current = false;
    setHint(null);
    let alive = true;
    void import('expo-camera').then(async (m) => {
      const p = await m.Camera.requestCameraPermissionsAsync();
      if (!alive) return;
      setCam(m);
      setGranted(p.granted);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  if (Platform.OS === 'web') return null;
  const CameraView = cam?.CameraView;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {CameraView && granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (done.current) return;
              const code = parseCheckinQr(data);
              if (!code) {
                setHint('QR นี้ไม่ใช่ QR เช็กอินของคลินิก (เช่น QR ชำระเงิน) · สแกน QR ที่เขียนว่า “QR เช็กอิน”');
                return;
              }
              done.current = true;
              onCode(code);
            }}
          />
        ) : null}
        {/* กรอบเล็ง */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: '#FFFFFF' }} />
        </View>
        <View style={{ position: 'absolute', top: insets.top + space[3], left: space[4], right: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="ปิด" onPress={onClose} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" color="#FFFFFF" />
          </Pressable>
          <Text variant="titleSm" color="#FFFFFF">
            สแกน QR เช็กอินที่เคาน์เตอร์
          </Text>
        </View>
        <View style={{ position: 'absolute', bottom: insets.bottom + space[6], left: space[5], right: space[5], gap: space[3] }}>
          {granted === false ? (
            <>
              <Text variant="bodyMd" color="#FFFFFF" align="center">
                ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดได้ที่ การตั้งค่า › ThaiWell AI › กล้อง หรือพิมพ์รหัสใต้ QR แทน
              </Text>
              <Button label="พิมพ์รหัสแทน" variant="secondary" onPress={onClose} />
            </>
          ) : (
            <Text variant="bodyMd" color="#FFFFFF" align="center">
              {hint ?? 'ส่องกล้องไปที่ QR บนจอที่เคาน์เตอร์ (เปลี่ยนทุก 30 วินาที)'}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
