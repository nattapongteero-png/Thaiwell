import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  IBMPlexSansThai_400Regular,
  IBMPlexSansThai_500Medium,
  IBMPlexSansThai_600SemiBold,
  IBMPlexSansThai_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-thai';
import { ThemeProvider } from './src/design-system';
import { APP_STATE_KEY, CHATS_KEY, JourneyProvider } from './src/state/JourneyContext';
import { SEEN_KEY } from './src/services/cloudBridge';
import { hydratePersist } from './src/services/persist';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * เว็บ: ล็อกหน้าเว็บไม่ให้เลื่อน/ลากออกนอกจอ — ทุกหน้าเลื่อนด้วย ScrollView ของแอปเอง
 * (ภาพพื้นหลังหน้าเข้าสู่ระบบ / แสงรอบลูกแก้ว / แถบแท็บที่เลื่อนได้ กว้างเกินจอ → เบราว์เซอร์ให้ลากหน้าไปมาได้)
 * overscroll-behavior: none = ไม่เด้ง/ไม่ลากทั้งหน้าบนมือถือ
 */
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('tw-lock-viewport')) {
  const style = document.createElement('style');
  style.id = 'tw-lock-viewport';
  style.textContent = 'html,body,#root{width:100%;height:100%;margin:0;overflow:hidden;overscroll-behavior:none;}#root{position:fixed;inset:0;}';
  document.head.appendChild(style);
}

export default function App() {
  const [loaded] = useFonts({
    IBMPlexSansThai_400Regular,
    IBMPlexSansThai_500Medium,
    IBMPlexSansThai_600SemiBold,
    IBMPlexSansThai_700Bold,
  });
  // มือถือ: โหลดข้อมูลที่จำไว้ก่อนแสดงแอป (เปิดใหม่กลับมาที่เดิม)
  const [restored, setRestored] = React.useState(Platform.OS === 'web');
  React.useEffect(() => {
    if (!restored) void hydratePersist([APP_STATE_KEY, SEEN_KEY, CHATS_KEY]).then(() => setRestored(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded || !restored) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider initial="brand">
        <JourneyProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </JourneyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
