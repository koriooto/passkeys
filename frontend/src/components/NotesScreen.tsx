import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NoteDecrypted, Session } from "../types";
import { createNote, deleteNote, listNotes, updateNote } from "../api/notes";
import Modal from "./Modal";

type NotesScreenProps = {
  session: Session;
  cryptoKey: CryptoKey;
};

const NotesScreen = ({ session, cryptoKey }: NotesScreenProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<NoteDecrypted | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NoteDecrypted | null>(null);
  const [previewTarget, setPreviewTarget] = useState<NoteDecrypted | null>(null);

  const notesQuery = useQuery({
    queryKey: ["notes", session.token],
    queryFn: () => listNotes(session.token, cryptoKey),
    enabled: !!cryptoKey,
    retry: false
  });

  const filtered = useMemo(() => {
    if (!notesQuery.data) {
      return [];
    }
    if (!search) {
      return notesQuery.data;
    }
    const normalized = search.toLowerCase();
    return notesQuery.data.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        note.text.toLowerCase().includes(normalized)
    );
  }, [notesQuery.data, search]);

  const handleSave = async (payload: { id?: string; title: string; text: string }) => {
    const { id, ...data } = payload;
    if (id) {
      await updateNote(session.token, cryptoKey, id, data);
    } else {
      await createNote(session.token, cryptoKey, data);
    }
    setEditing(null);
    setIsAddOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  const handleDelete = async (id: string) => {
    await deleteNote(session.token, id);
    setDeleteTarget(null);
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
  };

  return (
    <div className="min-h-full p-5">
      <div className="flex items-center gap-2">
        <img
          src="/icons/logo.png"
          alt="Passkeys"
          className="h-8 w-8 rounded-lg"
        />
        <h1 className="text-lg font-semibold">Заметки</h1>
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
          Добавить заметку
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {notesQuery.isLoading ? (
          <p className="text-sm text-white/60">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/60">Заметок нет</p>
        ) : (
          filtered.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{note.title}</p>
                <button
                  className="text-xs text-white/60"
                  onClick={() => setEditing(note)}
                >
                  Правка
                </button>
              </div>
              <p className="mt-2 text-xs text-white/70 line-clamp-3 whitespace-pre-wrap">
                {note.text}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                  onClick={() => setPreviewTarget(note)}
                >
                  Просмотр
                </button>
                
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70"
                  onClick={() => setDeleteTarget(note)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAddOpen ? (
        <Modal title="Добавить заметку" onClose={() => setIsAddOpen(false)}>
          <NoteForm
            initial={{ title: "", text: "" }}
            onCancel={() => setIsAddOpen(false)}
            onSave={handleSave}
            isEditing={false}
          />
        </Modal>
      ) : null}

      {editing ? (
        <Modal title="Редактировать заметку" onClose={() => setEditing(null)}>
          <NoteForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={handleSave}
            isEditing
          />
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Удалить заметку" onClose={() => setDeleteTarget(null)}>
          <div className="mt-3 space-y-3 text-xs text-white/70">
            <p>
              Удалить заметку <span className="font-semibold">{deleteTarget.title}</span>?
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

      {previewTarget ? (
        <Modal title={previewTarget.title} onClose={() => setPreviewTarget(null)}>
          <div className="mt-3 whitespace-pre-wrap text-xs text-white/70">
            {previewTarget.text}
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

const NoteForm = ({
  initial,
  onSave,
  onCancel,
  isEditing
}: {
  initial: { id?: string; title: string; text: string };
  onSave: (payload: { id?: string; title: string; text: string }) => Promise<void>;
  onCancel: () => void;
  isEditing: boolean;
}) => {
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ id: initial.id, title, text });
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
        placeholder="Название"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className="min-h-[120px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-accent"
        placeholder="Текст"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex gap-2">
        <button
          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold disabled:opacity-60"
          onClick={handleSubmit}
          disabled={!title || !text || saving}
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

export default NotesScreen;
