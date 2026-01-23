import { useState } from "react";
import { generatePassword } from "../utils/password";

type AccountFormProps = {
  initial: {
    id?: string;
    url: string;
    label: string;
    username: string;
    password: string;
  };
  onSave: (payload: {
    id?: string;
    url: string;
    label: string;
    username: string;
    password: string;
  }) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
};

const AccountForm = ({ initial, onSave, onCancel, isEditing }: AccountFormProps) => {
  const [url, setUrl] = useState(initial.url);
  const [label, setLabel] = useState(initial.label);
  const [username, setUsername] = useState(initial.username);
  const [password, setPassword] = useState(initial.password);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    setPassword(
      generatePassword({
        length: 16,
        includeUpper: true,
        includeLower: true,
        includeDigits: true,
        includeSymbols: true
      })
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ url, label, username, password, id: initial.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <input
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="URL"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="Название"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="Логин"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <input
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="Пароль"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button
        className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
        onClick={handleGenerate}
        type="button"
      >
        Сгенерировать пароль
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold disabled:opacity-60"
          onClick={handleSubmit}
          disabled={!url || !username || !password || saving}
        >
          {saving ? "Сохранение..." : isEditing ? "Сохранить" : "Добавить"}
        </button>
        {isEditing ? (
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
            onClick={onCancel}
          >
            Отмена
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default AccountForm;
