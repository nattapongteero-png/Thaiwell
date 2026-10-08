import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DockIcon, preloadBody3D, TabAccessoryProvider, TabBar, useTheme, type TabItem } from '../design-system';
import type { ClientTabParamList, ProviderTabParamList, RootStackParamList } from './types';

import { HomeScreen } from '../screens/client/HomeScreen';
import { ConsentScreen } from '../screens/client/Onboarding';
import { AuthScreen, IdentityScreen } from '../screens/client/Auth';
import { NotificationsScreen } from '../screens/client/NotificationsScreen';
import { BillScreen, BillsScreen } from '../screens/client/BillScreen';
import { CourseScreen } from '../screens/client/CourseScreen';
import { PlacesScreen } from '../screens/client/PlacesScreen';
import { ProgressScreen, ProfileScreen, PrivacyScreen, TreatmentHistoryScreen } from '../screens/client/ClientTabs';
import { BookingDoneScreen, BookingScreen } from '../screens/client/BookingScreen';
import { AppointmentDetailScreen } from '../screens/client/AppointmentDetail';
import { PlaceDetailScreen } from '../screens/client/places/PlaceDetail';
import { ElementQuizScreen } from '../screens/client/ElementQuizScreen';
import { InterviewScreen } from '../screens/client/InterviewScreen';
import { BodyMapScreen, AssessmentScreen } from '../screens/client/PreScreening';
import { PreSummaryScreen, CheckInScreen, RedFlagScreen } from '../screens/client/PreSummary';
import { PostAssessmentScreen, SessionResultScreen, FollowUpScreen, SelfCareScreen, StretchListScreen } from '../screens/client/AfterService';
import { PreVisitScreen } from '../screens/client/PreVisitScreen';
import { QueueScreen, InsightsScreen } from '../screens/provider/ProviderTabs';
import { ClientBriefScreen, SafetyCheckScreen } from '../screens/provider/BriefAndSafety';
import { CarePlanScreen, ServiceRecordScreen, ProviderDoneScreen } from '../screens/provider/PlanAndRecord';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const ProviderTab = createBottomTabNavigator<ProviderTabParamList>();

/** bottom-nav — หน้าแรก · ยืดเหยียด · สถานที่ · ประวัติ · โปรไฟล์ (จองบริการเข้าจากสถานที่/ผลประเมิน ไม่ใช่แท็บ) */
const CLIENT_TABS: Partial<Record<keyof ClientTabParamList, TabItem>> = {
  Home: { label: 'หน้าแรก', icon: (c, s, a) => <DockIcon name="home" color={c} size={s} active={a} /> },
  Stretch: { label: 'ยืดเหยียด', icon: (c, s, a) => <DockIcon name="stretch" color={c} size={s} active={a} /> },
  Places: { label: 'สถานที่', icon: (c, s, a) => <DockIcon name="places" color={c} size={s} active={a} /> },
  History: { label: 'ประวัติ', icon: (c, s, a) => <DockIcon name="history" color={c} size={s} active={a} /> },
  Profile: { label: 'โปรไฟล์', icon: (c, s, a) => <DockIcon name="profile" color={c} size={s} active={a} /> },
};

const PROVIDER_TABS: Record<keyof ProviderTabParamList, TabItem> = {
  Queue: { label: 'คิววันนี้', icon: (c, s, a) => <DockIcon name="queue" color={c} size={s} active={a} /> },
  Insights: { label: 'ภาพรวม', icon: (c, s, a) => <DockIcon name="insights" color={c} size={s} active={a} /> },
};

const StretchTab = () => <StretchListScreen tab />;

function ClientTabs() {
  return (
    <TabAccessoryProvider>
    <ClientTab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} items={CLIENT_TABS as Record<string, TabItem>} />}>
      <ClientTab.Screen name="Home" component={HomeScreen} />
      <ClientTab.Screen name="Stretch" component={StretchTab} />
      <ClientTab.Screen name="Places" component={PlacesScreen} />
      <ClientTab.Screen name="History" component={ProgressScreen} />
      <ClientTab.Screen name="Profile" component={ProfileScreen} />
    </ClientTab.Navigator>
    </TabAccessoryProvider>
  );
}

function ProviderTabs() {
  return (
    <TabAccessoryProvider>
    <ProviderTab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} items={PROVIDER_TABS} />}>
      <ProviderTab.Screen name="Queue" component={QueueScreen} />
      <ProviderTab.Screen name="Insights" component={InsightsScreen} />
    </ProviderTab.Navigator>
    </TabAccessoryProvider>
  );
}

export function RootNavigator() {
  // โหลดหุ่น 3D ล่วงหน้าตั้งแต่หน้าเข้าสู่ระบบ → ถึงหน้าแรกหุ่นพร้อมหมุนทันที
  React.useEffect(() => preloadBody3D(), []);
  const { colors } = useTheme();
  return (
    <NavigationContainer
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.surface.canvas, primary: colors.brand.primary } }}
    >
      <Stack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Identity" component={IdentityScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="Consent" component={ConsentScreen} />
        <Stack.Screen name="ElementQuiz" component={ElementQuizScreen} />
        <Stack.Screen name="Interview" component={InterviewScreen} />
        <Stack.Screen name="BodyMap" component={BodyMapScreen} />
        <Stack.Screen name="Assessment" component={AssessmentScreen} />
        <Stack.Screen name="PreSummary" component={PreSummaryScreen} />
        <Stack.Screen name="CheckIn" component={CheckInScreen} />
        <Stack.Screen name="Booking" component={BookingScreen as never} />
        <Stack.Screen name="BookingDone" component={BookingDoneScreen} />
        <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen as never} />
        <Stack.Screen name="PlaceDetail" component={PlaceDetailScreen as never} />
        <Stack.Screen name="TreatmentHistory" component={TreatmentHistoryScreen as never} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Bills" component={BillsScreen} />
        <Stack.Screen name="Course" component={CourseScreen} />
        <Stack.Screen name="Bill" component={BillScreen as never} />
        <Stack.Screen name="RedFlag" component={RedFlagScreen} options={{ animation: 'fade_from_bottom' }} />

        <Stack.Screen name="PostAssessment" component={PostAssessmentScreen} />
        <Stack.Screen name="PreVisit" component={PreVisitScreen} />
        <Stack.Screen name="SessionResult" component={SessionResultScreen} />
        <Stack.Screen name="FollowUp" component={FollowUpScreen} />
        <Stack.Screen name="SelfCare" component={SelfCareScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />

        <Stack.Screen name="ProviderTabs" component={ProviderTabs} />
        <Stack.Screen name="ClientBrief" component={ClientBriefScreen} />
        <Stack.Screen name="SafetyCheck" component={SafetyCheckScreen} />
        <Stack.Screen name="CarePlan" component={CarePlanScreen} />
        <Stack.Screen name="ServiceRecord" component={ServiceRecordScreen} />
        <Stack.Screen name="ProviderDone" component={ProviderDoneScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
