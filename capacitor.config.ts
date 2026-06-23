import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musgo.vendaseproducao',
  appName: 'APP VENDAS E PRODUCAO',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    LocalNotifications: {
      iconColor: '#4f46e5',
    },
  },
};

export default config;
