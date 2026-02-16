export type Session = {
  token: string;
  refreshToken?: string; // опционально для обратной совместимости
  email: string;
  kdfSalt: string;
};

export type AccountEncrypted = {
  id: string;
  url: string;
  label: string;
  usernameCipher: string;
  usernameNonce: string;
  passwordCipher: string;
  passwordNonce: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountDecrypted = {
  id: string;
  url: string;
  label: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteEncrypted = {
  id: string;
  titleCipher: string;
  titleNonce: string;
  textCipher: string;
  textNonce: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteDecrypted = {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};
