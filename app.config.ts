import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Hifz',
  slug: 'hifz-autopilot',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'hifz',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F7FAF7',
  },
  android: {
    package: 'app.hifz.autopilot',
    permissions: ['RECORD_AUDIO', 'VIBRATE'],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#E8F2EB',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'app.hifz.autopilot',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-audio',
      {
        microphonePermission:
          'আপনার তিলাওয়াত record করতে Hifz-কে microphone ব্যবহার করতে দিন।',
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
      },
    ],
    ['expo-notifications', { color: '#176B4D' }],
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: true,
  },
});
