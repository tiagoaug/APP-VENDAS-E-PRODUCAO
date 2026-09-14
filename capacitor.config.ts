import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musgo.vendaseproducao',
  appName: 'LIM.O APP',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      // 'apple.com' esteve removido daqui temporariamente porque o plugin nativo tenta
      // pré-configurar cada provider listado no boot, e sem a capability "Sign In with Apple"
      // no projeto Xcode (sem conta de desenvolvedor Apple ainda) isso travava a inicialização
      // nativa no iOS antes até da WebView carregar. Agora que existe conta de desenvolvedor e
      // o App.entitlements com com.apple.developer.applesignin foi adicionado (ver
      // ios/App/App/App.entitlements e CODE_SIGN_ENTITLEMENTS no project.pbxproj), voltou —
      // MAS ainda depende de habilitar a capability "Sign In with Apple" no App ID
      // (com.musgo.vendaseproducao) em developer.apple.com e o provider "Apple" em
      // Firebase Console > Authentication > Sign-in method antes de funcionar de verdade.
      providers: ['google.com', 'apple.com'],
    },
    LocalNotifications: {
      iconColor: '#4f46e5',
    },
  },
};

export default config;
