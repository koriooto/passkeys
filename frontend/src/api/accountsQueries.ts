import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "./accounts";

type AccountSavePayload = {
  id?: string;
  url: string;
  label: string;
  username: string;
  password: string;
};

export const useAccountsQuery = (token: string, cryptoKey: CryptoKey | null) =>
  useQuery({
    queryKey: ["accounts", token],
    queryFn: () => listAccounts(token, cryptoKey as CryptoKey),
    enabled: !!cryptoKey,
    retry: false
  });

export const useSaveAccountMutation = (token: string, cryptoKey: CryptoKey) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AccountSavePayload) => {
      const { id, ...data } = payload;
      if (id) {
        return updateAccount(token, cryptoKey, id, data);
      }
      return createAccount(token, cryptoKey, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });
};

export const useDeleteAccountMutation = (token: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAccount(token, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
  });
};
