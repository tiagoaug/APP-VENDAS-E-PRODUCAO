import { useState, useEffect, useCallback } from "react";
import { Fingerprint, KeyRound } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, resolveAuthCall } from "../lib/firebase";
import { getLoginUnlockCredentials, clearLoginUnlockCredentials } from "../utils/biometricAuth";

interface AppUnlockViewProps {
  biometricLabel: string;
  // Some pro LoginView normal — usado tanto no cancelamento quanto quando as credenciais
  // guardadas não servem mais (ex.: senha trocada em outro aparelho).
  onUseAnotherAccount: () => void;
}

export default function AppUnlockView({ biometricLabel, onUseAnotherAccount }: AppUnlockViewProps) {
  const [status, setStatus] = useState<'idle' | 'unlocking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    setStatus('unlocking');
    setError(null);
    try {
      const { username, password } = await getLoginUnlockCredentials(`Desbloquear o LIM.O APP`);
      await resolveAuthCall(signInWithEmailAndPassword(auth, username, password));
      // Sucesso: App.tsx detecta o novo usuário via onAuthStateChanged e troca de tela sozinho.
    } catch (err: any) {
      setStatus('error');
      // Código 21 (NO_PROTECTED_CREDENTIALS_FOUND) = credencial some (apagada/inválida) —
      // não faz sentido insistir, já cai direto pro login normal.
      if (err?.code === 21) {
        clearLoginUnlockCredentials();
        onUseAnotherAccount();
        return;
      }
      setError('Não foi possível desbloquear. Tente de novo ou entre com sua senha.');
    }
  }, [onUseAnotherAccount]);

  // Dispara o prompt sozinho assim que a tela aparece — o usuário só vê o botão se precisar
  // tentar de novo (cancelou, falhou o reconhecimento etc.).
  useEffect(() => {
    handleUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fc] p-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className={`w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 relative mt-4 ${status === 'unlocking' ? 'animate-pulse' : ''}`}>
          <Fingerprint className="text-white" size={40} strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-1 text-center">LIM.O APP</h1>
        <p className="text-[11px] font-bold text-slate-400 italic uppercase tracking-widest mb-10 text-center">
          {status === 'unlocking' ? `Confirmando com ${biometricLabel}...` : `Desbloqueie com ${biometricLabel}`}
        </p>

        {error && (
          <p className="text-red-500 text-xs text-center font-bold mb-6 px-4">{error}</p>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleUnlock}
            disabled={status === 'unlocking'}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Fingerprint size={18} strokeWidth={2.5} />
            {status === 'unlocking' ? 'Aguardando...' : `Desbloquear com ${biometricLabel}`}
          </button>

          <button
            type="button"
            onClick={onUseAnotherAccount}
            className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold py-3 uppercase tracking-widest text-[10px] hover:text-indigo-600 transition"
          >
            <KeyRound size={14} strokeWidth={2.5} />
            Entrar com senha
          </button>
        </div>
      </div>
    </div>
  );
}
