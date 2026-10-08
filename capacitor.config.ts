import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'issac.microbytz.xyz',
  appName: 'Isaac Search Engine',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
