import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'issac.microbytz.xyz',
  appName: 'Isaac Search Engine',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorUpdater: {
      // Manual mode — App.tsx checks /api/app/version and stages updates
      // with .next() so they apply on the next launch, never mid-session.
      autoUpdate: false,
      appReadyTimeout: 10000
    }
  }
};

export default config;
