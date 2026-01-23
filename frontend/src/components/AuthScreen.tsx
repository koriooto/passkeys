import { useState } from "react";
import type { Session } from "../types";
import { setStoredSession } from "../storage";
import { useAuthMutation } from "../api/authQueries";
import { deriveKey } from "../crypto/crypto";

type AuthMode = "login" | "register";

type AuthScreenProps = {
  onSuccess: (session: Session, key: CryptoKey) => void;
};

const AuthScreen = ({ onSuccess }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const authMutation = useAuthMutation();

  const handleSubmit = async () => {
    setError(null);
    try {
      const session = await authMutation.mutateAsync({ mode, email, password });
      await setStoredSession(session);
      const key = await deriveKey(password, session.kdfSalt);
      onSuccess(session, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    }
  };

  return (
    <div className="min-h-full p-6">
      <div className="rounded-2xl bg-panel p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src="/icons/logo.png"
            alt="Passkeys"
            className="h-10 w-10 rounded-xl"
          />
          <h1 className="text-2xl font-semibold">Passkeys Manager</h1>
        </div>
        <p className="mt-2 text-sm text-white/60">
          Хранилище заблокировано. Введите мастер-пароль.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              mode === "login" ? "bg-white/10" : "bg-white/5 text-white/60"
            }`}
            onClick={() => setMode("login")}
          >
            Вход
          </button>
          <button
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              mode === "register" ? "bg-white/10" : "bg-white/5 text-white/60"
            }`}
            onClick={() => setMode("register")}
          >
            Регистрация
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Мастер-пароль"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={handleSubmit}
            disabled={authMutation.isPending || !email || password.length < 6}
          >
            {authMutation.isPending ? "Подождите..." : mode === "login" ? "Войти" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
