import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Session } from "../types";
import { deriveKey } from "../crypto/crypto";
import { setStoredSession } from "../storage";
import { listAccounts, updateAccount } from "./accounts";
import { changeMasterPassword, loginUser, registerUser } from "./auth";

type AuthMode = "login" | "register";

export const useAuthMutation = () =>
  useMutation({
    mutationFn: async (payload: { mode: AuthMode; email: string; password: string }) => {
      const { mode, email, password } = payload;
      return mode === "login" ? loginUser(email, password) : registerUser(email, password);
    }
  });

export const useChangeMasterPasswordMutation = ({
  session,
  cryptoKey,
  onSessionUpdate,
  onKeyUpdate
}: {
  session: Session;
  cryptoKey: CryptoKey;
  onSessionUpdate: (session: Session) => void;
  onKeyUpdate: (key: CryptoKey) => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const result = await changeMasterPassword(
        session.token,
        payload.currentPassword,
        payload.newPassword
      );
      const newKey = await deriveKey(payload.newPassword, result.kdfSalt);
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
    }
  });
};
