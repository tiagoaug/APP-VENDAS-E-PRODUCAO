import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musgo.vendaseproducao',
  appName: 'LIM.O APP',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      // 'apple.com' removido temporariamente daqui — o plugin nativo tenta pré-configurar cada
      // provider listado no boot, e sem a capability "Sign In with Apple" no projeto Xcode
      // (nenhum .entitlements existe ainda, precisa de conta de desenvolvedor Apple) isso trava
      // a inicialização nativa no iOS antes até da WebView carregar (loading infinito, nunca
      // chega na tela de login — reproduzido no App Preview do Codemagic). O código JS de
      // signInWithApple (src/lib/firebase.ts) continua intacto pra quando isso for retomado.
      providers: ['google.com'],
    },
    LocalNotifications: {
      iconColor: '#4f46e5',
    },
  },
};

export default config;
