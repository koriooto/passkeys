import type { Session } from "../types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string;
  body?: unknown;
  _skipRefresh?: boolean;
};

type SessionConfig = {
  getSession: () => Session | null;
  setSession: (s: Session | null) => void;
};

let sessionConfig: SessionConfig | null = null;

export const setApiSessionConfig = (config: SessionConfig | null): void => {
  sessionConfig = config;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function doRequest<T>(
  path: string,
  options: RequestOptions
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  const tryRequest = async (token?: string): Promise<Response> => {
    return doRequest(path, { ...options, token: token ?? options.token });
  };

  let response = await tryRequest();

  // При 401 и наличии refreshToken пробуем обновить сессию
  if (
    response.status === 401 &&
    options.token &&
    !options._skipRefresh &&
    sessionConfig
  ) {
    const session = sessionConfig.getSession();
    if (session?.refreshToken) {
      try {
        const { refreshSession } = await import("./auth");
        const fresh = await refreshSession(session.refreshToken);
        const newSession: Session = {
          ...session,
          token: fresh.token,
          refreshToken: fresh.refreshToken ?? session.refreshToken
        };
        sessionConfig.setSession(newSession);
        response = await tryRequest(fresh.token);
      } catch {
        // refresh не удался, пробрасываем исходную 401
      }
    }
  }

  if (!response.ok) {
    const message = await response.text();
    throw new ApiError(message || "API request failed", response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};
