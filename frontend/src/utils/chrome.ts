export const getActiveTabUrl = async (): Promise<string | null> => {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return window.location?.href ?? null;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url ?? null;
};

export const sendFillMessage = async (
  username: string,
  password: string
): Promise<void> => {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  const tabUrl = tabs[0]?.url ?? null;

  if (chrome.storage?.local) {
    await chrome.storage.local.set({
      passkeys_last_credentials: { username, password, url: tabUrl }
    });
  }

  if (!tabId) {
    return;
  }

  await chrome.tabs.sendMessage(tabId, {
    type: "FILL_CREDENTIALS",
    payload: { username, password }
  });
};
