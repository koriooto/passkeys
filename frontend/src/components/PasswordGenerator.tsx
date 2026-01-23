import { useEffect, useState } from "react";
import { generatePassword, type PasswordOptions } from "../utils/password";

const PasswordGenerator = () => {
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUpper: true,
    includeLower: true,
    includeDigits: true,
    includeSymbols: true
  });
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState(false);

  const canGenerate =
    options.includeUpper ||
    options.includeLower ||
    options.includeDigits ||
    options.includeSymbols;

  const handleGenerate = () => {
    const next = generatePassword(options);
    setValue(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-panel p-4">
      <h2 className="text-sm font-semibold">Генератор паролей</h2>
      <div className="mt-4 space-y-3 text-xs text-white/70">
        <div>
          <div className="flex items-center justify-between">
            <span>Длина</span>
            <span>{options.length}</span>
          </div>
          <input
            type="range"
            min={8}
            max={32}
            value={options.length}
            className="mt-2 w-full"
            onChange={(event) =>
              setOptions((prev) => ({
                ...prev,
                length: Number(event.target.value)
              }))
            }
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="pk-checkbox"
            checked={options.includeUpper}
            onChange={(event) =>
              setOptions((prev) => ({
                ...prev,
                includeUpper: event.target.checked
              }))
            }
          />
          Заглавные буквы
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="pk-checkbox"
            checked={options.includeLower}
            onChange={(event) =>
              setOptions((prev) => ({
                ...prev,
                includeLower: event.target.checked
              }))
            }
          />
          Строчные буквы
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="pk-checkbox"
            checked={options.includeDigits}
            onChange={(event) =>
              setOptions((prev) => ({
                ...prev,
                includeDigits: event.target.checked
              }))
            }
          />
          Цифры
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="pk-checkbox"
            checked={options.includeSymbols}
            onChange={(event) =>
              setOptions((prev) => ({
                ...prev,
                includeSymbols: event.target.checked
              }))
            }
          />
          Символы
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs break-all">
        {value || "Нажмите «Сгенерировать»"}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold disabled:opacity-60"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          Сгенерировать
        </button>
        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-60"
          onClick={handleCopy}
          disabled={!value}
        >
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
    </div>
  );
};

export default PasswordGenerator;
