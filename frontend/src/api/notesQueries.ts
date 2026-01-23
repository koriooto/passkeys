import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNote, deleteNote, listNotes, updateNote } from "./notes";

type NoteSavePayload = {
  id?: string;
  title: string;
  text: string;
};

export const useNotesQuery = (token: string, cryptoKey: CryptoKey | null) =>
  useQuery({
    queryKey: ["notes", token],
    queryFn: () => listNotes(token, cryptoKey as CryptoKey),
    enabled: !!cryptoKey,
    retry: false
  });

export const useSaveNoteMutation = (token: string, cryptoKey: CryptoKey) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NoteSavePayload) => {
      const { id, ...data } = payload;
      if (id) {
        return updateNote(token, cryptoKey, id, data);
      }
      return createNote(token, cryptoKey, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
  });
};

export const useDeleteNoteMutation = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(token, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
    }
  });
};
