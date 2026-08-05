import type { ExpoConfig, ConfigContext } from 'expo/config';

// EAS Build injects this during the cloud Prebuild step (not set locally).
// Used to keep the sideloaded "preview" APK small without touching the
// Play Store "production" app-bundle, which already gets per-device ABI
// splitting from Google Play itself.
const isPreviewBuild = process.env.EAS_BUILD_PROFILE === 'preview';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Hifz',
  slug: 'hifzapp',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'hifz',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
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
    'expo-asset',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#F7FAF7',
      },
    ],
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
    'expo-sharing',
    [
      'expo-build-properties',
      {
        android: {
          // Only restrict native .so ABIs for the internal-distribution
          // "preview" APK (sideloaded for testing/sharing). Leave
          // unrestricted for "production" app-bundle builds -- Play Store
          // already performs per-device ABI splitting for .aab, so
          // restricting here would break installs for real users on
          // non-arm64 devices.
          ...(isPreviewBuild ? { buildArchs: ['arm64-v8a'] } : {}),
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '03f55cf8-86ad-4d27-806c-52a286d44cab',
    },
  },
});
