import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/app-state/provider';
import { ThemeProvider, useThemeColors, useThemeMode } from '@/theme/theme-context';

void SplashScreen.preventAutoHideAsync();

function ThemedStack() {
  const colors = useThemeColors();
  const { mode } = useThemeMode();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
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
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSansBengali: require('../../assets/fonts/NotoSansBengali-Regular.ttf'),
    NotoSansBengaliMedium: require('../../assets/fonts/NotoSansBengali-Medium.ttf'),
    NotoSerifBengali: require('../../assets/fonts/NotoSerifBengali-Regular.ttf'),
    NotoNaskhArabic: require('../../assets/fonts/NotoNaskhArabic-Regular.ttf'),
    NotoNaskhArabicBold: require('../../assets/fonts/NotoNaskhArabic-Bold.ttf'),
    Amiri: require('../../assets/fonts/Amiri-Regular.ttf'),
    AmiriBold: require('../../assets/fonts/Amiri-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemeProvider>
            <ThemedStack />
          </ThemeProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
