import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric';

// Nome amigável do tipo de biometria disponível NESTE aparelho (Face ID no iPhone,
// impressão digital/reconhecimento facial no Android) — null quando o aparelho não tem
// biometria disponível/cadastrada, caso em que a tela de login deve mostrar só o PIN.
export async function getBiometryLabel(): Promise<string | null> {
  try {
    const result = await BiometricAuth.checkBiometry();
    if (!result.isAvailable) return null;
    switch (result.biometryType) {
      case BiometryType.faceId:
        return 'Face ID';
      case BiometryType.touchId:
        return 'Touch ID';
      case BiometryType.faceAuthentication:
        return 'Reconhecimento Facial';
      case BiometryType.irisAuthentication:
        return 'Leitura de Íris';
      case BiometryType.fingerprintAuthentication:
        return 'Digital';
      default:
        return 'Biometria';
    }
  } catch {
    return null;
  }
}

// Dispara o prompt nativo (Face ID / Touch ID / leitor de digital). Retorna false tanto pra
// falha de reconhecimento quanto pra cancelamento do usuário — quem chama decide o que fazer
// (ex.: cair de volta pro PIN), sem precisar tratar o erro específico.
export async function authenticateBiometric(reason: string): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Usar PIN',
      androidTitle: 'Confirme sua identidade',
      allowDeviceCredential: false,
    });
    return true;
  } catch {
    return false;
  }
}

// --- Desbloqueio da TELA DE LOGIN por Face ID/Touch ID (diferente da biometria por
// colaborador acima, que já pressupõe uma sessão Firebase ativa) ---
//
// Guarda e-mail+senha no Keychain (iOS)/Keystore (Android) via @capgo/capacitor-native-biometric
// — plugin separado do @aparajita usado acima porque só ele oferece armazenamento seguro
// (setCredentials/getSecureCredentials); o @aparajita continua sendo o único usado pra
// biometria de colaborador. `getSecureCredentials` já dispara o prompt nativo de biometria
// sozinho (accessControl BIOMETRY_ANY exige isso pra ler o item do Keychain), então não
// precisa chamar authenticateBiometric() antes — evita prompt duplicado.
//
// Existe só pra contas de e-mail/senha: contas Google/Apple não têm senha pra guardar, então
// o checkbox de ativar não aparece pra esse fluxo (ver LoginView.tsx).
const LOGIN_UNLOCK_SERVER = 'com.musgo.vendaseproducao.loginUnlock';

export async function isNativeBiometricAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function isLoginUnlockEnabled(): Promise<boolean> {
  try {
    const { isSaved } = await NativeBiometric.isCredentialsSaved({ server: LOGIN_UNLOCK_SERVER });
    return isSaved;
  } catch (err) {
    // Engolir esse erro em silêncio (antes) fazia o app cair direto na tela normal de
    // login sem AVISO nenhum de que o desbloqueio rápido devia ter entrado — logado aqui pra
    // dar pra diagnosticar via Safari Web Inspector/adb logcat quando alguém reportar que
    // "marquei e não funcionou".
    console.error('[biometricAuth] isLoginUnlockEnabled falhou:', err);
    return false;
  }
}

export async function saveLoginUnlockCredentials(email: string, password: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: LOGIN_UNLOCK_SERVER,
    accessControl: AccessControl.BIOMETRY_ANY,
  });
}

// Dispara o prompt nativo de biometria e retorna as credenciais salvas se confirmado.
// Lança o erro original em caso de cancelamento/falha/nada salvo — quem chama decide a
// mensagem (ver AppUnlockView.tsx).
export async function getLoginUnlockCredentials(reason: string): Promise<{ username: string; password: string }> {
  return NativeBiometric.getSecureCredentials({ server: LOGIN_UNLOCK_SERVER, reason });
}

export async function clearLoginUnlockCredentials(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: LOGIN_UNLOCK_SERVER });
  } catch { }
}
