import {
  NotoNaskhArabic_400Regular,
  useFonts as useArabicFonts,
} from '@expo-google-fonts/noto-naskh-arabic';
import {
  NotoSansBengali_400Regular,
  NotoSansBengali_500Medium,
  useFonts as useBengaliFonts,
} from '@expo-google-fonts/noto-sans-bengali';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/app-state/provider';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [bengaliLoaded] = useBengaliFonts({
    NotoSansBengali: NotoSansBengali_400Regular,
    NotoSansBengaliMedium: NotoSansBengali_500Medium,
  });
  const [arabicLoaded] = useArabicFonts({
    NotoNaskhArabic: NotoNaskhArabic_400Regular,
  });

  useEffect(() => {
    if (bengaliLoaded && arabicLoaded) void SplashScreen.hideAsync();
  }, [arabicLoaded, bengaliLoaded]);

  if (!bengaliLoaded || !arabicLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="session" />
            <Stack.Screen name="settings" />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
