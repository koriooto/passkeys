import { apiRequest } from "./client";
import type { AccountDecrypted, AccountEncrypted } from "../types";
import { decryptField, encryptField } from "../crypto/crypto";

type AccountPayload = {
  url: string;
  label: string;
  username: string;
  password: string;
};

type AccountResponse = AccountEncrypted;

export const listAccountsEncrypted = async (
  token: string
): Promise<AccountEncrypted[]> => {
  return apiRequest<AccountEncrypted[]>("/accounts", { token });
};

export const listAccounts = async (
  token: string,
  key: CryptoKey
): Promise<AccountDecrypted[]> => {
  const accounts = await listAccountsEncrypted(token);
  return Promise.all(
    accounts.map(async (account) => ({
      id: account.id,
      url: account.url,
      label: account.label,
      username: await decryptField(account.usernameCipher, account.usernameNonce, key),
      password: await decryptField(account.passwordCipher, account.passwordNonce, key),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }))
  );
};

export const createAccount = async (
  token: string,
  key: CryptoKey,
  payload: AccountPayload
): Promise<AccountResponse> => {
  const username = await encryptField(payload.username, key);
  const password = await encryptField(payload.password, key);
  return apiRequest<AccountResponse>("/accounts", {
    method: "POST",
    token,
    body: {
      url: payload.url,
      label: payload.label,
      usernameCipher: username.cipher,
      usernameNonce: username.nonce,
      passwordCipher: password.cipher,
      passwordNonce: password.nonce
    }
  });
};

export const updateAccount = async (
  token: string,
  key: CryptoKey,
  id: string,
  payload: AccountPayload
): Promise<AccountResponse> => {
  const username = await encryptField(payload.username, key);
  const password = await encryptField(payload.password, key);
  return apiRequest<AccountResponse>(`/accounts/${id}`, {
    method: "PUT",
    token,
    body: {
      url: payload.url,
      label: payload.label,
      usernameCipher: username.cipher,
      usernameNonce: username.nonce,
      passwordCipher: password.cipher,
      passwordNonce: password.nonce
    }
  });
};

export const deleteAccount = async (token: string, id: string) => {
  return apiRequest<void>(`/accounts/${id}`, {
    method: "DELETE",
    token
  });
};
