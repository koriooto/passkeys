import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDecrypted, Session } from "../types";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "../api/accounts";
import { changeMasterPassword } from "../api/auth";
import { deriveKey } from "../crypto/crypto";
import { setStoredSession } from "../storage";
import { getActiveTabUrl, sendFillMessage } from "../utils/chrome";
import {
  AiOutlineCopy,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineSetting
} from "react-icons/ai";
import EmptyState from "./EmptyState";
import PasswordGenerator from "./PasswordGenerator";
import AccountForm from "./AccountForm";
import ChangeMasterPassword from "./ChangeMasterPassword";
import Modal from "./Modal";

type AccountsScreenProps = {
  session: Session;
  cryptoKey: CryptoKey;
  onLogout: () => void;
  onResetKey: () => void;
  onSessionUpdate: (session: Session) => void;
  onKeyUpdate: (key: CryptoKey) => void;
};

const AccountsScreen = ({
  session,
  cryptoKey,
  onLogout,
  onResetKey,
  onSessionUpdate,
  onKeyUpdate
}: AccountsScreenProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AccountDecrypted | null>(null);
  const [urlDefault, setUrlDefault] = useState<string>("");
  const [formKey, setFormKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [groupIndexMap, setGroupIndexMap] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<AccountDecrypted | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const loadUrl = async () => {
      const url = await getActiveTabUrl();
      if (url) {
        try {
          const parsed = new URL(url);
          setUrlDefault(parsed.href);
        } catch {
          setUrlDefault(url);
        }
      }
    };
    void loadUrl();
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["accounts", session.token],
    queryFn: () => listAccounts(session.token, cryptoKey),
    enabled: !!cryptoKey,
    retry: false
  });

  useEffect(() => {
    if (!accountsQuery.data || typeof chrome === "undefined" || !chrome.storage?.local) {
      return;
    }

    const siteMap: Record<string, { username: string; password: string; url: string }> = {};
    accountsQuery.data.forEach((account) => {
      try {
        const parsed = new URL(account.url);
        if (!siteMap[parsed.origin]) {
          siteMap[parsed.origin] = {
            username: account.username,
            password: account.password,
            url: account.url
          };
        }
      } catch {
        return;
      }
    });

    void chrome.storage.local.set({ passkeys_site_credentials: siteMap });
  }, [accountsQuery.data]);

  const filtered = useMemo(() => {
    if (!accountsQuery.data) {
      return [];
    }
    if (!search) {
      return accountsQuery.data;
    }
    const normalized = search.toLowerCase();
    return accountsQuery.data.filter(
      (account) =>
        account.url.toLowerCase().includes(normalized) ||
        account.label.toLowerCase().includes(normalized)
    );
  }, [accountsQuery.data, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AccountDecrypted[]>();
    filtered.forEach((account) => {
      let key = account.url;
      try {
        key = new URL(account.url).origin;
      } catch {
        key = account.url;
      }
      const list = map.get(key) ?? [];
      list.push(account);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([origin, accounts]) => ({
      origin,
      accounts
    }));
  }, [filtered]);

  useEffect(() => {
    setGroupIndexMap((prev) => {
      const next = { ...prev };
      grouped.forEach((group) => {
        const current = next[group.origin] ?? 0;
        const max = Math.max(0, group.accounts.length - 1);
        next[group.origin] = Math.min(current, max);
      });
      return next;
    });
  }, [grouped]);

  const handleSave = async (payload: {
    id?: string;
    url: string;
    label: string;
    username: string;
    password: string;
  }) => {
    const { id, ...data } = payload;
    if (id) {
      await updateAccount(session.token, cryptoKey, id, data);
    } else {
      await createAccount(session.token, cryptoKey, data);
    }
    setEditing(null);
    setIsAddOpen(false);
    setFormKey((prev) => prev + 1);
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(session.token, id);
    setDeleteTarget(null);
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const handleCopyPassword = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1500);
    } catch {
      setCopiedId(null);
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const result = await changeMasterPassword(
      session.token,
      currentPassword,
      newPassword
    );
    const newKey = await deriveKey(newPassword, result.kdfSalt);
    const accounts = await listAccounts(session.token, cryptoKey);

    await Promise.all(
      accounts.map((account) =>
        updateAccount(session.token, newKey, account.id, {
          url: account.url,
          label: account.label,
          username: account.username,
          password: account.password
        })
      )
    );

    const nextSession = { ...session, kdfSalt: result.kdfSalt };
    await setStoredSession(nextSession);
    onSessionUpdate(nextSession);
    onKeyUpdate(newKey);
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  return (
    <div className="min-h-full p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="/icons/logo.png"
              alt="Passkeys"
              className="h-8 w-8 rounded-lg"
            />
            <h1 className="text-lg font-semibold">Аккаунты</h1>
          </div>
          <p className="text-xs text-white/50">{session.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/60"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Настройки"
            title="Настройки"
          >
            <AiOutlineSetting width={20} height={20} />
          </button>
          <button className="text-xs text-white/60" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </div>
      <div className="mt-4">
        <input
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Поиск"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
          onClick={() => setIsAddOpen(true)}
        >
          Добавить запись
        </button>
      </div>

      {accountsQuery.isError ? (
        <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          Не удалось расшифровать данные. Проверьте мастер-пароль.
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-lg bg-red-500/30 px-3 py-1 text-xs"
              onClick={onResetKey}
            >
              Ввести заново
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {accountsQuery.isLoading ? (
          <p className="text-sm text-white/60">Загрузка...</p>
        ) : grouped.length === 0 ? (
          <EmptyState />
        ) : (
          grouped.map((group) => {
            const index = groupIndexMap[group.origin] ?? 0;
            const account = group.accounts[index];
            return (
              <div
                key={`${group.origin}-${account.id}`}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{account.label}</p>
                    <p className="text-xs text-white/50">{group.origin}</p>
                  </div>
                  <button
                    className="text-xs text-white/60"
                    onClick={() => setEditing(account)}
                  >
                    Правка
                  </button>
                </div>
                {group.accounts.length > 1 ? (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 px-2 py-1 text-xs text-white/70">
                    <button
                      className="px-2 text-white/60 disabled:opacity-40"
                      onClick={() =>
                        setGroupIndexMap((prev) => ({
                          ...prev,
                          [group.origin]: Math.max(0, index - 1)
                        }))
                      }
                      disabled={index === 0}
                    >
                      <AiOutlineArrowLeft width={36} height={36} />
                    </button>
                    <span>
                      Аккаунт {index + 1} из {group.accounts.length}
                    </span>
                    <button
                      className="px-2 text-white/60 disabled:opacity-40"
                      onClick={() =>
                        setGroupIndexMap((prev) => ({
                          ...prev,
                          [group.origin]: Math.min(
                            group.accounts.length - 1,
                            index + 1
                          )
                        }))
                      }
                      disabled={index === group.accounts.length - 1}
                    >
                      <AiOutlineArrowRight width={36} height={36} />
                    </button>
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold"
                    onClick={() => sendFillMessage(account.username, account.password)}
                  >
                    Подставить
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                    onClick={() => handleCopyPassword(account.password, account.id)}
                    title="Скопировать пароль"
                  >
                    {copiedId === account.id ? "Скопировано" : <AiOutlineCopy width={36} height={36} />}
                  </button>
                  <button
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                    onClick={() => setDeleteTarget(account)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <details className="mt-6 rounded-xl border border-white/10 bg-panel p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white/80">
          Генератор паролей
        </summary>
        <div className="mt-3">
          <PasswordGenerator />
        </div>
      </details>

      {isAddOpen ? (
        <Modal title="Добавить веб-сайт" onClose={() => setIsAddOpen(false)}>
          <AccountForm
            key={`${urlDefault}-${formKey}`}
            initial={{ url: urlDefault, label: "", username: "", password: "" }}
            onCancel={() => setIsAddOpen(false)}
            onSave={handleSave}
            isEditing={false}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Редактировать" onClose={() => setEditing(null)}>
          <AccountForm
            key={editing.id}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={handleSave}
            isEditing
          />
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Удалить запись" onClose={() => setDeleteTarget(null)}>
          <div className="mt-3 space-y-3 text-xs text-white/70">
            <p>
              Удалить запись <span className="font-semibold">{deleteTarget.label}</span>?
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-red-500/80 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => handleDelete(deleteTarget.id)}
              >
                Удалить
              </button>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                onClick={() => setDeleteTarget(null)}
              >
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {isSettingsOpen ? (
        <Modal title="Настройки" onClose={() => setIsSettingsOpen(false)}>
          <ChangeMasterPassword onSubmit={handleChangePassword} />
        </Modal>
      ) : null}
    </div>
  );
};

export default AccountsScreen;

