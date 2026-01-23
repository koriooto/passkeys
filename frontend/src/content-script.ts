type FillPayload = {
  username: string;
  password: string;
  url?: string | null;
};

const STORAGE_KEY = "passkeys_last_credentials";
const SITE_STORAGE_KEY = "passkeys_site_credentials";
const PENDING_ACCOUNT_KEY = "passkeys_pending_account";
const AUTH_URL_KEYWORDS = [
  "auth",
  "login",
  "signin",
  "sign-in",
  "sign_in",
  "signup",
  "sign-up",
  "sign_up",
  "password"
];

const REGISTRATION_URL_KEYWORDS = [
  "signup",
  "sign-up",
  "sign_up",
  "register",
  "registration",
  "create-account",
  "create_account"
];

const isVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isAuthLikeUrl = () => {
  const href = window.location.href.toLowerCase();
  return AUTH_URL_KEYWORDS.some((keyword) => href.includes(keyword));
};

const isRegistrationUrl = () => {
  const href = window.location.href.toLowerCase();
  return REGISTRATION_URL_KEYWORDS.some((keyword) => href.includes(keyword));
};

const createSuggestedPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}~";
  const pools = [upper, lower, digits, symbols];

  const randomInt = (max: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };

  const all = pools.join("");
  const result: string[] = [];

  pools.forEach((pool) => {
    result.push(pool[randomInt(pool.length)]);
  });

  while (result.length < 16) {
    result.push(all[randomInt(all.length)]);
  }

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
};

type PendingAccountPayload = {
  url: string;
  label: string;
  username: string;
  password: string;
  createdAt: number;
};

const findPasswordInputIn = (form: HTMLFormElement) => {
  const candidates = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="password"]')
  );
  return candidates.find((input) => !input.disabled && isVisible(input)) ?? null;
};

const findUsernameInputIn = (
  form: HTMLFormElement,
  passwordInput: HTMLInputElement | null
) => {
  const inputs = Array.from(
    form.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i], input[name*="email" i]'
    )
  );
  const usable = inputs.filter((input) => !input.disabled && isVisible(input));

  if (passwordInput) {
    const preferred = usable.find(
      (input) => input.type === "text" || input.type === "email"
    );
    if (preferred) {
      return preferred;
    }
  }

  return usable[0] ?? null;
};

const buildPendingPayload = (passwordInput: HTMLInputElement) => {
  const password = passwordInput.value.trim();
  if (!password) {
    return null;
  }
  let url = window.location.href;
  let label = document.title.trim();
  try {
    const parsed = new URL(window.location.href);
    url = parsed.origin;
    label = parsed.hostname;
  } catch {
    // keep defaults
  }

  return {
    url,
    label,
    username: "",
    password,
    createdAt: Date.now()
  } satisfies PendingAccountPayload;
};

let savePrompt: HTMLDivElement | null = null;

const hideSavePrompt = () => {
  if (savePrompt) {
    savePrompt.remove();
    savePrompt = null;
  }
};

const showSavePrompt = (payload: PendingAccountPayload) => {
  if (savePrompt) {
    return;
  }
  savePrompt = document.createElement("div");
  savePrompt.style.position = "fixed";
  savePrompt.style.left = "50%";
  savePrompt.style.top = "16px";
  savePrompt.style.transform = "translateX(-50%)";
  savePrompt.style.zIndex = "2147483647";
  savePrompt.style.background = "#1f1f24";
  savePrompt.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  savePrompt.style.borderRadius = "12px";
  savePrompt.style.padding = "10px 12px";
  savePrompt.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.35)";
  savePrompt.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  savePrompt.style.fontSize = "12px";
  savePrompt.style.color = "white";
  savePrompt.style.display = "flex";
  savePrompt.style.alignItems = "center";
  savePrompt.style.gap = "10px";

  const label = document.createElement("span");
  label.textContent = "Сохранить учетные данные в Passkeys?";
  label.style.whiteSpace = "nowrap";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Сохранить";
  saveButton.style.background = "#2E90FA";
  saveButton.style.border = "none";
  saveButton.style.color = "white";
  saveButton.style.padding = "6px 10px";
  saveButton.style.borderRadius = "8px";
  saveButton.style.cursor = "pointer";
  saveButton.style.fontSize = "12px";

  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.textContent = "Не сейчас";
  dismissButton.style.background = "transparent";
  dismissButton.style.border = "none";
  dismissButton.style.color = "rgba(255, 255, 255, 0.7)";
  dismissButton.style.cursor = "pointer";
  dismissButton.style.fontSize = "12px";

  saveButton.addEventListener("click", async () => {
    const passwordInput = findPasswordInput();
    const usernameInput = findUsernameInput(passwordInput);
    const updatedPayload = {
      ...payload,
      username: usernameInput?.value.trim() ?? payload.username
    };

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      await chrome.storage.local.set({ [PENDING_ACCOUNT_KEY]: updatedPayload });
    }
    hideSavePrompt();
  });

  dismissButton.addEventListener("click", hideSavePrompt);

  savePrompt.appendChild(label);
  savePrompt.appendChild(saveButton);
  savePrompt.appendChild(dismissButton);
  document.body.appendChild(savePrompt);
};

const isSupportedInput = (input: HTMLInputElement) => {
  const type = input.type;
  return (
    (type === "password" || type === "text" || type === "email") &&
    !input.disabled &&
    !input.readOnly &&
    isVisible(input)
  );
};

const findPasswordInput = (): HTMLInputElement | null => {
  const candidates = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  );
  return candidates.find((input) => !input.disabled && isVisible(input)) ?? null;
};

const findUsernameInput = (passwordInput: HTMLInputElement | null) => {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[type="text"], input[type="email"], input[name*="user" i], input[name*="login" i]'
    )
  );
  const usable = inputs.filter((input) => !input.disabled && isVisible(input));

  if (passwordInput) {
    const form = passwordInput.closest("form");
    if (form) {
      const inForm = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const preferred = inForm.find(
        (input) =>
          input.type !== "password" &&
          !input.disabled &&
          isVisible(input) &&
          (input.type === "text" || input.type === "email")
      );
      if (preferred) {
        return preferred;
      }
    }
  }

  return usable[0] ?? null;
};

const fillInput = (input: HTMLInputElement, value: string) => {
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const getCachedCredentials = async (): Promise<FillPayload | null> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null;
  }
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as FillPayload | undefined) ?? null;
  } catch {
    return null;
  }
};

const getCredentialsForSite = async (): Promise<FillPayload | null> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null;
  }
  try {
    const origin = new URL(window.location.href).origin;
    const result = await chrome.storage.local.get([SITE_STORAGE_KEY, STORAGE_KEY]);
    const siteMap = result[SITE_STORAGE_KEY] as
      | Record<string, FillPayload>
      | undefined;
    const siteCreds = siteMap?.[origin];
    if (siteCreds) {
      return siteCreds;
    }
    const last = result[STORAGE_KEY] as FillPayload | undefined;
    return last ?? null;
  } catch {
    return null;
  }
};

const isCredentialMatch = (creds: FillPayload) => {
  if (!creds.url) {
    return true;
  }
  try {
    const stored = new URL(creds.url);
    const current = new URL(window.location.href);
    return stored.origin === current.origin;
  } catch {
    return true;
  }
};

let popover: HTMLDivElement | null = null;
let popoverButton: HTMLButtonElement | null = null;
let currentInput: HTMLInputElement | null = null;
let currentAction: (() => void) | null = null;

const ensurePopover = () => {
  if (popover) {
    return;
  }
  popover = document.createElement("div");
  popover.style.position = "absolute";
  popover.style.zIndex = "2147483647";
  popover.style.background = "#1f1f24";
  popover.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  popover.style.borderRadius = "10px";
  popover.style.padding = "6px";
  popover.style.display = "none";
  popover.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
  popover.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  popover.style.fontSize = "12px";

  popoverButton = document.createElement("button");
  popoverButton.type = "button";
  popoverButton.style.background = "#2E90FA";
  popoverButton.style.border = "none";
  popoverButton.style.color = "white";
  popoverButton.style.padding = "6px 10px";
  popoverButton.style.borderRadius = "8px";
  popoverButton.style.cursor = "pointer";
  popoverButton.style.fontSize = "12px";

  popoverButton.addEventListener("click", () => {
    if (currentAction) {
      currentAction();
    }
    hidePopover();
  });

  popover.appendChild(popoverButton);
  popover.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  document.body.appendChild(popover);
};

const positionPopover = (input: HTMLInputElement) => {
  if (!popover) {
    return;
  }
  const rect = input.getBoundingClientRect();
  const top = rect.top + window.scrollY;
  const left = rect.right + window.scrollX + 8;
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
};

const showPopover = (input: HTMLInputElement, label: string, action: () => void) => {
  ensurePopover();
  if (!popover || !popoverButton) {
    return;
  }
  currentInput = input;
  currentAction = action;
  popoverButton.textContent = label;
  positionPopover(input);
  popover.style.display = "block";
};

const hidePopover = () => {
  if (popover) {
    popover.style.display = "none";
  }
  currentInput = null;
  currentAction = null;
};

const fillPair = (username: string, password: string) => {
  const passwordInput = findPasswordInput();
  const usernameInput = findUsernameInput(passwordInput);

  if (usernameInput) {
    fillInput(usernameInput, username);
  }
  if (passwordInput) {
    fillInput(passwordInput, password);
  }
};

const hasPair = () => {
  const passwordInput = findPasswordInput();
  const usernameInput = findUsernameInput(passwordInput);
  return { passwordInput, usernameInput };
};

let autoFilled = false;

const tryAutoFill = async () => {
  if (autoFilled) {
    return;
  }
  if (!isAuthLikeUrl()) {
    return;
  }
  const creds = await getCredentialsForSite();
  if (!creds || !isCredentialMatch(creds)) {
    return;
  }
  const { passwordInput, usernameInput } = hasPair();
  if (passwordInput && usernameInput) {
    fillInput(usernameInput, creds.username);
    fillInput(passwordInput, creds.password);
    autoFilled = true;
  } else if (passwordInput) {
    fillInput(passwordInput, creds.password);
    autoFilled = true;
  } else if (usernameInput) {
    fillInput(usernameInput, creds.username);
    autoFilled = true;
  }
};

document.addEventListener("focusin", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !isSupportedInput(target)) {
    hidePopover();
    return;
  }
  if (!isAuthLikeUrl()) {
    hidePopover();
    return;
  }

  if (isRegistrationUrl() && target.type === "password") {
    showPopover(target, "Сгенерировать пароль", () => {
      const password = createSuggestedPassword();
      if (password) {
        fillInput(target, password);
      }
    });
    return;
  }

  const creds = await getCredentialsForSite();
  if (!creds || !isCredentialMatch(creds)) {
    hidePopover();
    return;
  }

  const { passwordInput, usernameInput } = hasPair();
  if (passwordInput && usernameInput) {
    showPopover(target, "Вставить логин и пароль", () =>
      fillPair(creds.username, creds.password)
    );
    return;
  }

  if (target.type === "password") {
    showPopover(target, "Вставить пароль", () => fillInput(target, creds.password));
  } else {
    showPopover(target, "Вставить логин", () => fillInput(target, creds.username));
  }
});

document.addEventListener("mousedown", (event) => {
  if (!popover || popover.style.display !== "block") {
    return;
  }
  const target = event.target as Node;
  if (popover.contains(target) || target === currentInput) {
    return;
  }
  hidePopover();
});

document.addEventListener("scroll", () => {
  if (currentInput && popover && popover.style.display === "block") {
    positionPopover(currentInput);
  }
}, true);

window.addEventListener("resize", () => {
  if (currentInput && popover && popover.style.display === "block") {
    positionPopover(currentInput);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  void tryAutoFill();
});

const observer = new MutationObserver(() => {
  void tryAutoFill();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener(
  "submit",
  (event) => {
    if (!isRegistrationUrl()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) {
      return;
    }
    const passwordInput = findPasswordInputIn(target);
    if (!passwordInput) {
      return;
    }
    const payload = buildPendingPayload(passwordInput);
    if (!payload) {
      return;
    }
    const usernameInput = findUsernameInputIn(target, passwordInput);
    if (usernameInput?.value) {
      payload.username = usernameInput.value.trim();
    }
    showSavePrompt(payload);
  },
  true
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FILL_CREDENTIALS") {
    return;
  }

  const payload = message.payload as FillPayload;
  fillPair(payload.username, payload.password);

  sendResponse({ ok: true });
});
