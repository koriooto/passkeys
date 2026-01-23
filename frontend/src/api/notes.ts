import { apiRequest } from "./client";
import type { NoteDecrypted, NoteEncrypted } from "../types";
import { decryptField, encryptField } from "../crypto/crypto";

type NotePayload = {
  title: string;
  text: string;
};

export const listNotesEncrypted = async (
  token: string
): Promise<NoteEncrypted[]> => {
  return apiRequest<NoteEncrypted[]>("/notes", { token });
};

export const listNotes = async (
  token: string,
  key: CryptoKey
): Promise<NoteDecrypted[]> => {
  const notes = await listNotesEncrypted(token);
  return Promise.all(
    notes.map(async (note) => ({
      id: note.id,
      title: await decryptField(note.titleCipher, note.titleNonce, key),
      text: await decryptField(note.textCipher, note.textNonce, key),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt
    }))
  );
};

export const createNote = async (
  token: string,
  key: CryptoKey,
  payload: NotePayload
): Promise<NoteEncrypted> => {
  const title = await encryptField(payload.title, key);
  const text = await encryptField(payload.text, key);
  return apiRequest<NoteEncrypted>("/notes", {
    method: "POST",
    token,
    body: {
      titleCipher: title.cipher,
      titleNonce: title.nonce,
      textCipher: text.cipher,
      textNonce: text.nonce
    }
  });
};

export const updateNote = async (
  token: string,
  key: CryptoKey,
  id: string,
  payload: NotePayload
): Promise<NoteEncrypted> => {
  const title = await encryptField(payload.title, key);
  const text = await encryptField(payload.text, key);
  return apiRequest<NoteEncrypted>(`/notes/${id}`, {
    method: "PUT",
    token,
    body: {
      titleCipher: title.cipher,
      titleNonce: title.nonce,
      textCipher: text.cipher,
      textNonce: text.nonce
    }
  });
};

export const deleteNote = async (token: string, id: string) => {
  return apiRequest<void>(`/notes/${id}`, {
    method: "DELETE",
    token
  });
};
