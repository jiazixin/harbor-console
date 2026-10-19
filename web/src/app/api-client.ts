import type {
  ApiErrorPayload,
  ConnectRequest,
  ControlDataResponse,
  ControlList,
  ControlListResponse,
  Dashboard,
  HarborIdentity,
  HarborInstanceCollection,
  HarborPermission,
  Session,
  SearchResults,
  HarborArtifact,
  ProjectSummary,
  PublicCatalogRequest,
  RepositorySummary,
} from "./models";
import { readStoredLocale } from "./locale-context";
import { translateServerMessage } from "./server-messages";

type QueryValue = boolean | number | string | null | undefined;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? response.json()
    : response.text();
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === "string" && payload) return payload;
  if (payload && typeof payload === "object") {
    const value = payload as ApiErrorPayload;
    if (value.details) return value.details;
    if (value.error) return value.error;
  }
  return readStoredLocale() === "en-US"
    ? `Request failed (${String(status)})`
    : `请求失败（${String(status)}）`;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers,
  });
  const payload = await parseResponse(response);
  if (!response.ok)
    throw new ApiError(
      translateServerMessage(
        errorMessage(payload, response.status),
        readStoredLocale(),
      ),
      response.status,
    );
  return payload as T;
}

function controlPath(
  operation: string,
  parameters: Record<string, QueryValue> = {},
): string {
  const query = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return `/api/control/${operation}${query.size ? `?${query}` : ""}`;
}

export const controlApi = {
  list: async <T>(
    operation: string,
    parameters: Record<string, QueryValue> = {},
    signal?: AbortSignal,
  ): Promise<ControlList<T>> => {
    const response = await request<ControlListResponse<T>>(
      controlPath(operation, parameters),
      { signal },
    );
    return {
      items: response.items ?? [],
      pagination: {
        page: Math.max(1, response.pagination?.page ?? 1),
        page_size: Math.max(1, response.pagination?.page_size ?? 20),
        total: Math.max(0, response.pagination?.total ?? 0),
      },
    };
  },
  data: async <T>(
    operation: string,
    parameters: Record<string, QueryValue> = {},
    signal?: AbortSignal,
  ): Promise<T | undefined> => {
    const response = await request<ControlDataResponse<T>>(
      controlPath(operation, parameters),
      { signal },
    );
    return response.data;
  },
  mutate: <T>(
    operation: string,
    parameters: Record<string, QueryValue>,
    method: "DELETE" | "PATCH" | "POST" | "PUT",
    payload?: unknown,
    signal?: AbortSignal,
  ) =>
    request<T>(controlPath(operation, parameters), {
      method,
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal,
    }),
};

export async function loadAllControlItems<T>(
  operation: string,
  parameters: Record<string, QueryValue> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  for (;;) {
    const collection = await controlApi.list<T>(
      operation,
      { ...parameters, page, page_size: 100 },
      signal,
    );
    items.push(...collection.items);

    if (
      collection.items.length === 0 ||
      items.length >= collection.pagination.total
    ) {
      return items;
    }
    page += 1;
  }
}

export const sessionApi = {
  current: (signal?: AbortSignal) =>
    request<Session>("/api/session", { signal }),
  connect: (input: ConnectRequest, signal?: AbortSignal) =>
    request<Session>("/api/connect", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    }),
  demo: (signal?: AbortSignal) =>
    request<Session>("/api/demo", {
      method: "POST",
      body: "{}",
      signal,
    }),
  logout: (signal?: AbortSignal) =>
    request<null>("/api/session", { method: "DELETE", signal }),
};

async function publicCatalogList<T>(
  resource: "artifacts" | "projects" | "repositories",
  input: PublicCatalogRequest,
  signal?: AbortSignal,
): Promise<ControlList<T>> {
  const response = await request<ControlListResponse<T>>(
    `/api/public/${resource}`,
    {
      method: "POST",
      body: JSON.stringify(input),
      credentials: "omit",
      signal,
    },
  );
  return {
    items: response.items ?? [],
    pagination: {
      page: Math.max(1, response.pagination?.page ?? input.page),
      page_size: Math.max(1, response.pagination?.page_size ?? input.page_size),
      total: Math.max(0, response.pagination?.total ?? 0),
    },
  };
}

export const publicCatalogApi = {
  projects: (input: PublicCatalogRequest, signal?: AbortSignal) =>
    publicCatalogList<ProjectSummary>("projects", input, signal),
  repositories: (input: PublicCatalogRequest, signal?: AbortSignal) =>
    publicCatalogList<RepositorySummary>("repositories", input, signal),
  artifacts: (input: PublicCatalogRequest, signal?: AbortSignal) =>
    publicCatalogList<HarborArtifact>("artifacts", input, signal),
};

export const instanceApi = {
  list: (signal?: AbortSignal) =>
    request<HarborInstanceCollection>("/api/instances", { signal }),
  add: (input: ConnectRequest, signal?: AbortSignal) =>
    request<Session>("/api/instances", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    }),
  addDemo: (signal?: AbortSignal) =>
    request<Session>("/api/instances/demo", {
      method: "POST",
      body: "{}",
      signal,
    }),
  switch: (id: string, signal?: AbortSignal) =>
    request<Session>("/api/instances/current", {
      method: "PUT",
      body: JSON.stringify({ id }),
      signal,
    }),
  remove: (id: string, signal?: AbortSignal) =>
    request<Session>(`/api/instances/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
    }),
};

export const searchApi = {
  search: (term: string, signal?: AbortSignal) =>
    request<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`, {
      signal,
    }),
};

export const dashboardApi = {
  load: (signal?: AbortSignal) =>
    request<Dashboard>("/api/dashboard", { signal }),
};

export const identityApi = {
  current: async (signal?: AbortSignal) => {
    const response = await request<ControlDataResponse<HarborIdentity>>(
      "/api/control/current-user",
      { signal },
    );
    return response.data;
  },
  permissions: async (signal?: AbortSignal) => {
    const query = new URLSearchParams({ scope: "/", relative: "true" });
    const response = await request<ControlListResponse<HarborPermission>>(
      `/api/control/current-permissions?${query}`,
      { signal },
    );
    return response.items ?? [];
  },
};
