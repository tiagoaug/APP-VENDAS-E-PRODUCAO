import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';

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
