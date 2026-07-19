import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.isaac.searchengine',
  appName: 'Isaac Search Engine',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
