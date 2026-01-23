import { useState } from "react";
import type { Session } from "../types";
import { deriveKey } from "../crypto/crypto";

type UnlockScreenProps = {
  session: Session;
  onUnlock: (key: CryptoKey) => void;
  onLogout: () => void;
};

const UnlockScreen = ({ session, onUnlock, onLogout }: UnlockScreenProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const key = await deriveKey(password, session.kdfSalt);
      onUnlock(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось разблокировать");
    } finally {
      setSubmitting(false);
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
        <div className="mt-5 space-y-3">
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
            onClick={handleUnlock}
            disabled={submitting || password.length < 6}
          >
            {submitting ? "Подождите..." : "Разблокировать"}
          </button>
          <button
            className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70"
            onClick={onLogout}
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnlockScreen;
