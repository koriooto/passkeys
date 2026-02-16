import { useEffect, useRef, useState } from "react";
import type { Session } from "./types";
import { setApiSessionConfig } from "./api/client";
import {
  cacheCryptoKey,
  clearCachedCryptoKey,
  clearStoredSession,
  getStoredSession,
  loadCachedCryptoKey,
  setStoredSession
} from "./storage";
import AuthScreen from "./components/AuthScreen";
import UnlockScreen from "./components/UnlockScreen";
import AccountsScreen from "./components/AccountsScreen";
import NotesScreen from "./components/NotesScreen";
import PasswordGeneratorScreen from "./components/PasswordGeneratorScreen";
import ToastProvider from "./components/ToastProvider";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"passwords" | "notes" | "generator">(
    "passwords"
  );
  const lastCacheRef = useRef(0);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    setApiSessionConfig({
      getSession: () => sessionRef.current,
      setSession: (s) => {
        setSession(s);
        if (s) void setStoredSession(s);
      }
    });
    return () => setApiSessionConfig(null);
  }, []);

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

  let content: JSX.Element;

  if (loading) {
    content = <div className="p-6 text-white/70">Загрузка...</div>;
  } else if (!session) {
    content = (
      <AuthScreen
        onSuccess={(nextSession, key) => {
          setSession(nextSession);
          setCryptoKey(key);
        }}
      />
    );
  } else if (!cryptoKey) {
    content = (
      <UnlockScreen
        session={session}
        onUnlock={(key) => setCryptoKey(key)}
        onLogout={handleLogout}
      />
    );
  } else {
    content = (
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
          <button
            className={`flex-1 rounded-lg px-3 py-2 ${
              section === "generator" ? "bg-accent text-white" : "text-white/60"
            }`}
            onClick={() => setSection("generator")}
          >
            Генератор
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
        ) : section === "notes" ? (
          <NotesScreen session={session} cryptoKey={cryptoKey} />
        ) : (
          <PasswordGeneratorScreen />
        )}
      </div>
    );
  }

  return <ToastProvider>{content}</ToastProvider>;
}
