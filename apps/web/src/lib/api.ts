import type {
  ApiTokenCreated,
  ApiTokenSummary,
  AuthToken,
  PaginatedRepositories,
  Repository,
  RepositoryCreate,
  RepositoryFile,
  RepositoryFiles,
  RepoType,
  User,
  Visibility,
} from "@/lib/types";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export const AUTH_TOKEN_KEY = "model-hub-access-token";

type QueryValue = string | number | boolean | undefined;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
};

type ValidationError = {
  loc?: Array<string | number>;
  msg?: string;
};

type ErrorBody = {
  detail?: string | ValidationError[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function storeToken(token: string): void {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function errorMessage(body: ErrorBody | null, status: number): string {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) {
    return body.detail
      .map((item) => {
        const field = item.loc?.at(-1);
        return `${field ? `${field}: ` : ""}${item.msg ?? "内容格式不正确"}`;
      })
      .join("；");
  }
  if (status === 401) return "登录状态已失效，请重新登录";
  if (status === 403) return "你没有权限进行此操作";
  if (status === 404) return "请求的内容不存在";
  if (status >= 500) return "服务器暂时出现问题，请稍后重试";
  return "请求失败，请检查填写内容";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const url = new URL(`/api/v1${path}`, API_BASE_URL);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const token = options.token === undefined ? getStoredToken() : options.token;
  const headers = new Headers({ Accept: "application/json" });
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isFormData) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined
        ? undefined
        : isFormData
          ? options.body as FormData
          : JSON.stringify(options.body),
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(`无法连接后端服务（${API_BASE_URL}）`, 0);
  }

  if (!response.ok) {
    let body: ErrorBody | null = null;
    try {
      body = (await response.json()) as ErrorBody;
    } catch {
      // The status code still gives the user a useful fallback message.
    }
    throw new ApiError(errorMessage(body, response.status), response.status);
  }

  return response;
}

export const authApi = {
  register(payload: {
    username: string;
    email: string;
    password: string;
    display_name: string;
  }) {
    return request<AuthToken>("/auth/register", { method: "POST", body: payload, token: null });
  },
  login(payload: { username: string; password: string }) {
    return request<AuthToken>("/auth/login", { method: "POST", body: payload, token: null });
  },
  me(token?: string | null) {
    return request<User>("/auth/me", { token });
  },
  updateMe(payload: { display_name?: string; bio?: string }) {
    return request<User>("/auth/me", { method: "PATCH", body: payload });
  },
};

export const repositoriesApi = {
  list(
    filters: {
      q?: string;
      repo_type?: RepoType;
      tag?: string;
      page?: number;
      page_size?: number;
    },
    signal?: AbortSignal,
  ) {
    return request<PaginatedRepositories>("/repositories", {
      query: filters,
      signal,
    });
  },
  create(payload: RepositoryCreate) {
    return request<Repository>("/repositories", { method: "POST", body: payload });
  },
  get(repoType: RepoType, owner: string, slug: string, signal?: AbortSignal) {
    return request<Repository>(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { signal },
    );
  },
  update(
    repoType: RepoType,
    owner: string,
    slug: string,
    payload: Partial<{
      name: string;
      visibility: Visibility;
      description: string;
      tags: string[];
      license: string;
      readme: string;
    }>,
  ) {
    return request<Repository>(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { method: "PATCH", body: payload },
    );
  },
  remove(repoType: RepoType, owner: string, slug: string) {
    return request<void>(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`,
      { method: "DELETE" },
    );
  },
  listFiles(
    repoType: RepoType,
    owner: string,
    slug: string,
    path = "",
    signal?: AbortSignal,
  ) {
    return request<RepositoryFiles>(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files`,
      { query: { path }, signal },
    );
  },
  uploadFile(
    repoType: RepoType,
    owner: string,
    slug: string,
    file: File,
    path: string,
    useLfs: boolean,
  ) {
    const body = new FormData();
    body.set("file", file);
    body.set("path", path);
    body.set("use_lfs", String(useLfs));
    return request<RepositoryFile>(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files`,
      { method: "POST", body },
    );
  },
  async downloadFile(repoType: RepoType, owner: string, slug: string, path: string) {
    const response = await send(
      `/repositories/${encodeURIComponent(repoType)}/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/files/${path.split("/").map(encodeURIComponent).join("/")}`,
    );
    return response.blob();
  },
};

export const tokensApi = {
  list() {
    return request<ApiTokenSummary[]>("/tokens");
  },
  create(name: string) {
    return request<ApiTokenCreated>("/tokens", { method: "POST", body: { name } });
  },
  remove(tokenId: number) {
    return request<void>(`/tokens/${tokenId}`, { method: "DELETE" });
  },
};
