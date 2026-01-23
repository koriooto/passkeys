type FillPayload = {
  username: string;
  password: string;
  url?: string | null;
};

const STORAGE_KEY = "passkeys_last_credentials";
const SITE_STORAGE_KEY = "passkeys_site_credentials";

const isVisible = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FILL_CREDENTIALS") {
    return;
  }

  const payload = message.payload as FillPayload;
  fillPair(payload.username, payload.password);

  sendResponse({ ok: true });
});
