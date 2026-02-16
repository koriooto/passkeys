import { apiRequest } from "./client";
import type { Session } from "../types";

type AuthResponse = {
  token: string;
  refreshToken: string;
  email: string;
  kdfSalt: string;
};

type RefreshResponse = {
  token: string;
  refreshToken: string;
};

type ChangePasswordResponse = {
  kdfSalt: string;
};

export const registerUser = async (
  email: string,
  password: string
): Promise<Session> => {
  const data = await apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: { email, password }
  });
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    email: data.email,
    kdfSalt: data.kdfSalt
  };
};

export const loginUser = async (
  email: string,
  password: string
): Promise<Session> => {
  const data = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password }
  });
  return {
    token: data.token,
    refreshToken: data.refreshToken,
    email: data.email,
    kdfSalt: data.kdfSalt
  };
};

export const refreshSession = async (
  refreshToken: string
): Promise<Pick<Session, "token" | "refreshToken">> => {
  const data = await apiRequest<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: { refreshToken }
  });
  return { token: data.token, refreshToken: data.refreshToken };
};

export const changeMasterPassword = async (
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<{ kdfSalt: string }> => {
  const data = await apiRequest<ChangePasswordResponse>("/auth/password", {
    method: "POST",
    token,
    body: { currentPassword, newPassword }
  });
  return { kdfSalt: data.kdfSalt };
};
