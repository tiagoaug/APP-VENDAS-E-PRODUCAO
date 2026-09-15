import React, { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { auth, signInWithGoogle, signInWithApple, resolveAuthCall } from "../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Mail, Lock, Fingerprint } from "lucide-react";
import { isNativeBiometricAvailable, getBiometryLabel, saveLoginUnlockCredentials } from "../utils/biometricAuth";
import { toast } from "../utils/toast";

interface RecentAccount {
  name: string;
  email: string;
  color: string;
  initial: string;
}

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>([]);
  const [showRecentAccounts, setShowRecentAccounts] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  // Desbloqueio por Face ID/Touch ID — só faz sentido pra contas de e-mail/senha (Google/Apple
  // não têm senha pra guardar no Keychain, ver src/utils/biometricAuth.ts). O checkbox só
  // aparece se o aparelho tem biometria disponível.
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [enableFaceIdUnlock, setEnableFaceIdUnlock] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('musgo_recent_accounts');
    if (stored) {
      try {
        setRecentAccounts(JSON.parse(stored));
      } catch (e) { }
    }
    if (Capacitor.isNativePlatform()) {
      isNativeBiometricAvailable().then(async (available) => {
        if (available) {
          setBiometricLabel(await getBiometryLabel());
        }
      });
    }
  }, []);

  const saveRecentAccount = (user: any) => {
    const colors = ['bg-amber-400', 'bg-emerald-400', 'bg-blue-400', 'bg-rose-400', 'bg-purple-400', 'bg-indigo-400'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const account: RecentAccount = {
      name: user.displayName || user.email.split('@')[0].toUpperCase(),
      email: user.email,
      initial: (user.displayName || user.email)[0].toUpperCase(),
      color: randomColor
    };

    const stored = localStorage.getItem('musgo_recent_accounts');
    let accounts: RecentAccount[] = [];
    if (stored) {
      try { accounts = JSON.parse(stored); } catch (e) { }
    }

    const existing = accounts.find(a => a.email === account.email);
    if (existing) {
      account.color = existing.color;
    }

    accounts = accounts.filter(a => a.email !== account.email);
    accounts.unshift(account);
    accounts = accounts.slice(0, 3);

    localStorage.setItem('musgo_recent_accounts', JSON.stringify(accounts));
    setRecentAccounts(accounts);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Evita reenvio: cliques repetidos enquanto a tela "parece travada" (sem loading visível
    // antes) chegaram a estourar a cota do Firebase de verificação de senha
    // (auth/quota-exceeded) — cada clique era uma nova tentativa de login somada às anteriores.
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const authCall = isRegistering
        ? createUserWithEmailAndPassword(auth, email, password)
        : signInWithEmailAndPassword(auth, email, password);
      const userCredential = await resolveAuthCall(authCall);
      saveRecentAccount(userCredential.user);
      // Melhor esforço: se salvar no Keychain falhar por algum motivo, não deve derrubar um
      // login que já deu certo — só o desbloqueio rápido na próxima vez que fica indisponível.
      // O erro real, antes, era engolido em silêncio (catch vazio) — quem reportasse "marquei e
      // não funcionou" não tinha como saber o motivo. Agora loga no console (visível via Safari
      // Web Inspector/adb logcat) e avisa com um toast que some sozinho, sem travar o login.
      if (biometricLabel && enableFaceIdUnlock) {
        try {
          await saveLoginUnlockCredentials(email, password);
        } catch (biometricErr: any) {
          console.error('[LoginView] Falha ao salvar credenciais pro desbloqueio rápido:', biometricErr);
          toast.show(`Login ok, mas não deu pra ativar o ${biometricLabel}: ${biometricErr?.message || biometricErr}`);
        }
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      // Assuming signInWithGoogle returns a UserCredential or User directly depending on implementation
      // Our lib/firebase.ts typically returns the user credential or handles it
      // Let's ensure it catches the auth state
      const result: any = await resolveAuthCall(signInWithGoogle());
      if (result && result.user) {
        saveRecentAccount(result.user);
      } else if (auth.currentUser) {
        saveRecentAccount(auth.currentUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request') {
        setError('Login cancelado.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppleLogin = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const result: any = await resolveAuthCall(signInWithApple());
      if (result && result.user) {
        saveRecentAccount(result.user);
      } else if (auth.currentUser) {
        saveRecentAccount(auth.currentUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectRecentAccount = (account: RecentAccount) => {
    setEmail(account.email);
    setPassword("");
    setIsRegistering(false);
    setError(null);
    setShowRecentAccounts(false);
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f9fc] p-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Header Icon */}
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-6 relative mt-4">
          <div className="absolute -top-2 w-10 h-2 bg-indigo-400/30 blur-md rounded-full"></div>
          <Fingerprint className="text-white" size={32} strokeWidth={1.5} />
        </div>

        {/* Titles */}
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-1">Bem-Vindo</h1>
        <p className="text-[11px] font-bold text-slate-400 italic uppercase tracking-widest mb-10">Acesse sua central de gestão</p>

        {/* Contas Recentes — atalho compacto (a lista completa fica num popup, ver mais
            abaixo). Antes ficava tudo aberto na tela, empurrando o formulário de login pra
            baixo da dobra em telas menores. */}
        {recentAccounts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRecentAccounts(true)}
            className="w-full flex items-center gap-3 p-3 mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition group text-left"
          >
            <div className="flex -space-x-2 shrink-0">
              {recentAccounts.slice(0, 3).map((account) => (
                <div
                  key={account.email}
                  className={`w-9 h-9 rounded-full ${account.color} flex items-center justify-center text-white font-black text-xs shadow-inner ring-2 ring-white`}
                >
                  {account.initial}
                </div>
              ))}
            </div>
            <span className="flex-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition">
              Contas Recentes
            </span>
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Ver</span>
          </button>
        )}

        {/* Form Card */}
        <div className="w-full bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white relative z-10">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition" size={18} strokeWidth={2.5} />
              <input
                type="email"
                placeholder="SEU E-MAIL"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-[#f8f9fc] border-2 border-transparent text-slate-800 text-sm font-bold placeholder:uppercase placeholder:tracking-widest placeholder:text-slate-400 focus:border-indigo-100 focus:bg-white outline-none transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition" size={18} strokeWidth={2.5} />
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                placeholder="SUA SENHA"
                className="w-full pl-12 pr-12 py-4 rounded-2xl bg-[#f8f9fc] border-2 border-transparent text-slate-800 text-sm font-bold placeholder:uppercase placeholder:tracking-widest placeholder:text-slate-400 focus:border-indigo-100 focus:bg-white outline-none transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
              </button>
            </div>

            {!isRegistering && biometricLabel && (
              <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableFaceIdUnlock}
                  onChange={(e) => setEnableFaceIdUnlock(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Ativar entrar com {biometricLabel} da próxima vez
                </span>
              </label>
            )}

            {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all duration-300 mt-2 disabled:opacity-60 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
            >
              {submitting ? "Entrando..." : (isRegistering ? "Confirmar Cadastro" : "Entrar no Sistema")}
            </button>
          </form>

          <div className="flex items-center justify-center gap-4 my-6">
            <div className="h-px bg-slate-100 flex-1"></div>
            <span className="text-[10px] font-black text-slate-300 italic uppercase">OU</span>
            <div className="h-px bg-slate-100 flex-1"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-700 font-black py-4 rounded-2xl border-2 border-[#f8f9fc] hover:bg-[#f8f9fc] hover:border-slate-100 transition uppercase tracking-widest text-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Entrar com Google
          </button>

          <button
            onClick={handleAppleLogin}
            type="button"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 bg-black text-white font-black py-4 rounded-2xl border-2 border-black hover:bg-slate-800 hover:border-slate-800 transition uppercase tracking-widest text-xs mt-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.256-1.75-2.264-4.36-2.264-6.85 0-4.03 2.64-6.16 5.23-6.16 1.35 0 2.47.9 3.32.9.81 0 2.06-.95 3.6-.95.586 0 2.69.05 4.08 2.02-.104.07-2.434 1.42-2.434 4.35 0 3.51 3.086 4.68 3.144 4.7z" />
            </svg>
            Entrar com Apple
          </button>

          <div
            className="mt-8 text-center text-[10px] text-slate-400 font-black uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Já tem uma conta? Entrar" : "Criar Nova Conta"}
          </div>
        </div>

      </div>

      {/* Popup de Contas Recentes */}
      {showRecentAccounts && (
        <div
          className="fixed inset-0 z-[65000] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowRecentAccounts(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4 bg-white animate-in slide-in-from-bottom-4 duration-300 max-h-[80vh] overflow-y-auto"
          >
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Contas Recentes</span>

            <div className="w-full space-y-3">
              {recentAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => selectRecentAccount(account)}
                  className="w-full flex items-center p-4 bg-[#f8f9fc] rounded-2xl hover:bg-indigo-50 transition group text-left"
                >
                  <div className={`w-12 h-12 rounded-full ${account.color} flex items-center justify-center text-white font-black shadow-inner flex-shrink-0 mr-4`}>
                    {account.initial}
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight truncate group-hover:text-indigo-600 transition">{account.name}</span>
                    <span className="text-[11px] font-medium text-slate-400 truncate">{account.email}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition py-2"
              onClick={() => { setEmail(""); setPassword(""); setShowRecentAccounts(false); }}
            >
              Usar Outra Conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
