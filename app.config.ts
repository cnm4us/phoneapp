import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Phoneapp POC',
  slug: 'phoneapp',
  owner: 'mbcollins2',
  scheme: 'phoneapp',
  version: '0.1.0',
  orientation: 'portrait',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.bawebtech.phoneapp.poc',
    // Current privately tested standard-crypto POC; reassess for public distribution/new crypto features.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: { package: 'com.bawebtech.phoneapp.poc', allowBackup: false },
  plugins: [
    './plugins/with-phoneapp-calling',
    'expo-dev-client',
    ['expo-camera',{cameraPermission:'Allow Phoneapp to record video messages and make video calls.',microphonePermission:'Allow Phoneapp to record sound for messages and calls.',recordAudioAndroid:true,barcodeScannerEnabled:false}],
    ['expo-video',{}],
    ['expo-audio',{microphonePermission:'Allow Phoneapp to record your audio messages.',enableBackgroundRecording:false,enableBackgroundPlayback:false}],
    ['expo-build-properties', { ios: { enableSceneSupport: true } }],
    ['@config-plugins/react-native-webrtc', {
      cameraPermission: 'Allow Phoneapp POC to use your camera for video messages and calls.',
      microphonePermission: 'Allow Phoneapp POC to use your microphone for messages and calls.',
    }],
  ],
  ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID || '942392a3-1d9c-4d2c-91b0-0ad939e4e1fd' } },
};
export default config;
