import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeIcon from '../../assets/figma/home.svg';
import CalendarIcon from '../../assets/figma/calendar.svg';
import ClockIcon from '../../assets/figma/clock.svg';
import UserIcon from '../../assets/figma/user.svg';
import { Icon, TabAccessoryProvider, TabBar, useTheme, type TabItem } from '../design-system';
import type { ClientTabParamList, ProviderTabParamList, RootStackParamList } from './types';

import { HomeScreen } from '../screens/client/HomeScreen';
import { ConsentScreen } from '../screens/client/Onboarding';
import { AuthScreen, SignupInfoScreen } from '../screens/client/Auth';
import { PlacesScreen } from '../screens/client/PlacesScreen';
import { Feather } from '@expo/vector-icons';
import { ProgressScreen, ProfileScreen, PrivacyScreen, TreatmentHistoryScreen } from '../screens/client/ClientTabs';
import { BookingDoneScreen, BookingScreen } from '../screens/client/BookingScreen';
import { ElementQuizScreen } from '../screens/client/ElementQuizScreen';
import { InterviewScreen } from '../screens/client/InterviewScreen';
import { AIVoiceScreen } from '../screens/client/AIVoiceScreen';
import { BodyMapScreen, AssessmentScreen } from '../screens/client/PreScreening';
import { PreSummaryScreen, CheckInScreen, RedFlagScreen } from '../screens/client/PreSummary';
import { PostAssessmentScreen, SessionResultScreen, FollowUpScreen, SelfCareScreen } from '../screens/client/AfterService';
import { QueueScreen, InsightsScreen } from '../screens/provider/ProviderTabs';
import { ClientBriefScreen, SafetyCheckScreen } from '../screens/provider/BriefAndSafety';
import { CarePlanScreen, ServiceRecordScreen, ProviderDoneScreen } from '../screens/provider/PlanAndRecord';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const ProviderTab = createBottomTabNavigator<ProviderTabParamList>();

/** bottom-nav — หน้าแรก · สถานที่ · ประวัติ · โปรไฟล์ (จองบริการเข้าจากสถานที่/ผลประเมิน ไม่ใช่แท็บ) */
const CLIENT_TABS: Partial<Record<keyof ClientTabParamList, TabItem>> = {
  Home: { label: 'หน้าแรก', icon: (c, s) => <HomeIcon width={s} height={s} color={c} /> },
  Places: { label: 'สถานที่', icon: (c, s) => <Feather name="map-pin" size={s} color={c} /> },
  History: { label: 'ประวัติ', icon: (c, s) => <ClockIcon width={s} height={s} color={c} /> },
  Profile: { label: 'โปรไฟล์', icon: (c, s) => <UserIcon width={s} height={s} color={c} /> },
};

const PROVIDER_TABS: Record<keyof ProviderTabParamList, TabItem> = {
  Queue: { label: 'คิววันนี้', icon: (c) => <Icon name="list" size="lg" color={c} /> },
  Insights: { label: 'ภาพรวม', icon: (c) => <Icon name="bar-chart-2" size="lg" color={c} /> },
};

function ClientTabs() {
  return (
    <TabAccessoryProvider>
    <ClientTab.Navigator screenOptions={{ headerShown: false }} tabBar={(p) => <TabBar {...p} items={CLIENT_TABS as Record<string, TabItem>} />}>
      <ClientTab.Screen name="Home" component={HomeScreen} />
      <ClientTab.Screen name="Places" component={PlacesScreen} />
      <ClientTab.Screen name="History" component={ProgressScreen} />
      <ClientTab.Screen name="Profile" component={ProfileScreen} />
      <ClientTab.Screen name="Booking" component={BookingScreen} />
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
  const { colors } = useTheme();
  return (
    <NavigationContainer
      theme={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.surface.canvas, primary: colors.brand.primary } }}
    >
      <Stack.Navigator initialRouteName="Auth" screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="SignupInfo" component={SignupInfoScreen as never} />
        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="Consent" component={ConsentScreen} />
        <Stack.Screen name="ElementQuiz" component={ElementQuizScreen} />
        <Stack.Screen name="Interview" component={InterviewScreen} />
        <Stack.Screen name="AIVoice" component={AIVoiceScreen} options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="BodyMap" component={BodyMapScreen} />
        <Stack.Screen name="Assessment" component={AssessmentScreen} />
        <Stack.Screen name="PreSummary" component={PreSummaryScreen} />
        <Stack.Screen name="CheckIn" component={CheckInScreen} />
        <Stack.Screen name="BookingDone" component={BookingDoneScreen} />
        <Stack.Screen name="TreatmentHistory" component={TreatmentHistoryScreen as never} />
        <Stack.Screen name="RedFlag" component={RedFlagScreen} options={{ animation: 'fade_from_bottom' }} />

        <Stack.Screen name="PostAssessment" component={PostAssessmentScreen} />
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
