import { useEffect, useRef, useState } from "react";
import type { Session } from "./types";
import {
  cacheCryptoKey,
  clearCachedCryptoKey,
  clearStoredSession,
  getStoredSession,
  loadCachedCryptoKey
} from "./storage";
import AuthScreen from "./components/AuthScreen";
import UnlockScreen from "./components/UnlockScreen";
import AccountsScreen from "./components/AccountsScreen";
import NotesScreen from "./components/NotesScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"passwords" | "notes">("passwords");
  const lastCacheRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const stored = await getStoredSession();
      if (stored) {
        setSession(stored);
        const cachedKey = await loadCachedCryptoKey();
        if (cachedKey) {
          setCryptoKey(cachedKey);
        }
      }
      setLoading(false);
    };
    void load();
  }, []);

  const handleLogout = async () => {
    await clearStoredSession();
    await clearCachedCryptoKey();
    setSession(null);
    setCryptoKey(null);
  };

  useEffect(() => {
    if (!cryptoKey) {
      return;
    }

    const idleMs = 5 * 60 * 1000;
    let timer: number | undefined;

    const resetTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      const now = Date.now();
      if (cryptoKey && now - lastCacheRef.current > 60_000) {
        lastCacheRef.current = now;
        void cacheCryptoKey(cryptoKey);
      }
      timer = window.setTimeout(() => {
        void clearCachedCryptoKey();
        setCryptoKey(null);
      }, idleMs);
    };

    const events = ["mousemove", "mousedown", "keydown", "focus"];
    events.forEach((event) => window.addEventListener(event, resetTimer, true));
    resetTimer();

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
      events.forEach((event) =>
        window.removeEventListener(event, resetTimer, true)
      );
    };
  }, [cryptoKey]);

  useEffect(() => {
    if (!cryptoKey) {
      return;
    }
    lastCacheRef.current = Date.now();
    void cacheCryptoKey(cryptoKey);
  }, [cryptoKey]);

  if (loading) {
    return <div className="p-6 text-white/70">Загрузка...</div>;
  }

  if (!session) {
    return (
      <AuthScreen
        onSuccess={(nextSession, key) => {
          setSession(nextSession);
          setCryptoKey(key);
        }}
      />
    );
  }

  if (!cryptoKey) {
    return (
      <UnlockScreen
        session={session}
        onUnlock={(key) => setCryptoKey(key)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-full">
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/40 px-4 py-3 text-xs">
        <button
          className={`flex-1 rounded-lg px-3 py-2 ${
            section === "passwords" ? "bg-accent text-white" : "text-white/60"
          }`}
          onClick={() => setSection("passwords")}
        >
          Аккаунты
        </button>
        <button
          className={`flex-1 rounded-lg px-3 py-2 ${
            section === "notes" ? "bg-accent text-white" : "text-white/60"
          }`}
          onClick={() => setSection("notes")}
        >
          Заметки
        </button>
      </div>
      {section === "passwords" ? (
        <AccountsScreen
          session={session}
          cryptoKey={cryptoKey}
          onLogout={handleLogout}
          onResetKey={() => setCryptoKey(null)}
          onSessionUpdate={(nextSession) => setSession(nextSession)}
          onKeyUpdate={(key) => setCryptoKey(key)}
        />
      ) : (
        <NotesScreen session={session} cryptoKey={cryptoKey} />
      )}
    </div>
  );
}
