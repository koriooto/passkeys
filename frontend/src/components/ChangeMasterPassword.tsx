import { useState } from "react";

const ChangeMasterPassword = ({
    onSubmit
  }: {
    onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  }) => {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
  
    const handleSubmit = async () => {
      setSaving(true);
      setError(null);
      setSuccess(false);
      try {
        if (newPassword !== confirmPassword) {
          throw new Error("Пароли не совпадают");
        }
        await onSubmit(currentPassword, newPassword);
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось изменить пароль");
      } finally {
        setSaving(false);
      }
    };
  
    return (
      <div className="mt-6 rounded-xl border border-white/10 bg-panel p-4">
        <h2 className="text-sm font-semibold">Сменить мастер-пароль</h2>
        <div className="mt-3 space-y-3">
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
            placeholder="Текущий мастер-пароль"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
            placeholder="Новый мастер-пароль"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
            placeholder="Повторите новый пароль"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          {success ? <p className="text-xs text-emerald-400">Пароль обновлен</p> : null}
          <button
            className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-semibold disabled:opacity-60"
            onClick={handleSubmit}
            disabled={
              saving ||
              currentPassword.length < 6 ||
              newPassword.length < 6 ||
              confirmPassword.length < 6
            }
          >
            {saving ? "Обновление..." : "Сменить пароль"}
          </button>
        </div>
      </div>
    );
  };
export default ChangeMasterPassword;
