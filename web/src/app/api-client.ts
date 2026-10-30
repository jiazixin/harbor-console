import { readApiErrorBody } from "./api-errors";
import type {
  ConnectRequest,
  ControlList,
  ControlListResponse,
  Dashboard,
  HarborArtifact,
  HarborIdentity,
  HarborInstanceCollection,
  HarborPermission,
  ProjectSummary,
  PublicCatalogRequest,
  RepositorySummary,
  SearchResults,
  Session,
} from "./models";
import { sessionEvents } from "./session-events";

export type QueryValue = boolean | number | string | null | undefined;

export type ApiErrorInit = {
  status: number; // HTTP status; 0 for client-side failures
  code: string; // server error.code, or a client code from 代码规范.md §5.3
  requestId: string; // X-Request-ID; empty when unavailable
  details?: Record<string, unknown>;
  retryAfterMs?: number; // parsed Retry-After
  canRetry?: boolean;
};

/**
 * A failed API request. message is English developer text; the user text in
 * the current locale comes from errorText in errors.ts.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly details: Record<string, unknown>;
  readonly retryAfterMs: number | undefined;
  readonly canRetry: boolean;

  constructor(message: string, init: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.details = init.details ?? {};
    this.retryAfterMs = init.retryAfterMs;
    this.canRetry = init.canRetry ?? true;
  }
}

export type ApiOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** The public catalog calls anonymous endpoints without the session cookie. */
  credentials?: RequestCredentials;
};

// Every endpoint answers within the upstream budget (30 s by default); a
// request still open after this is treated as lost.
const requestTimeoutMs = 60_000;
const maxResponseBytes = 8 << 20;

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    throw new Error("response content type is not application/json");
  }
  if (!response.body) throw new Error("response body is missing");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel("response exceeds size limit");
        throw new Error("response exceeds size limit");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
}

/** Maps a failed fetch: a caller's cancel stays a native AbortError. */
function clientFailure(
  error: unknown,
  signal: AbortSignal | undefined,
  timeout: AbortSignal,
) {
  if (signal?.aborted) return error;
  if (timeout.aborted)
    return new ApiError("request timed out", {
      status: 0,
      code: "timeout",
      requestId: "",
    });
  return new ApiError("network request failed", {
    status: 0,
    code: "network_unavailable",
    requestId: "",
  });
}

/**
 * Sends a request to the console server; the response is asserted to be T.
 * Queries retry through TanStack Query, so this wrapper does not retry.
 */
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    signal,
    headers = {},
    credentials = "same-origin",
  } = options;
  if (!path.startsWith("/api/")) {
    throw new ApiError("request path must be a console API path", {
      status: 0,
      code: "invalid_argument",
      requestId: "",
      canRetry: false,
    });
  }
  const canRetry =
    method === "GET" || new Headers(headers).has("Idempotency-Key");
  const timeout = AbortSignal.timeout(requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials,
      redirect: "error",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error: unknown) {
    const failure = clientFailure(error, signal, timeout);
    if (failure instanceof ApiError) {
      throw new ApiError(failure.message, {
        status: failure.status,
        code: failure.code,
        requestId: failure.requestId,
        canRetry,
      });
    }
    throw failure;
  }
  const requestId = response.headers.get("X-Request-ID") ?? "";
  let payload: unknown;
  try {
    payload = await parseResponse(response);
  } catch {
    if (signal?.aborted) signal.throwIfAborted();
    if (timeout.aborted)
      throw new ApiError("response read timed out", {
        status: 0,
        code: "timeout",
        requestId,
        canRetry,
      });
    throw new ApiError("response is not readable", {
      status: response.status,
      code: "invalid_response",
      requestId,
      canRetry,
    });
  }
  if (!response.ok) {
    const failure = readApiErrorBody(payload);
    if (response.status === 401 && failure?.code === "unauthenticated") {
      sessionEvents.dispatchEvent(new Event("expired"));
    }
    throw new ApiError(failure?.message || `HTTP ${String(response.status)}`, {
      status: response.status,
      code: failure?.code ?? "",
      requestId,
      details: failure?.details,
      retryAfterMs: parseRetryAfter(response.headers.get("Retry-After")),
      canRetry,
    });
  }
  return payload as T;
}

/**
 * Converts the console's page model to the API's offset paging; other
 * parameters pass through.
 */
function toOffsetPaging(
  parameters: Record<string, QueryValue>,
): Record<string, QueryValue> {
  const { page, page_size: pageSize, ...rest } = parameters;
  if (page === undefined && pageSize === undefined) return rest;
  const limit = Math.max(1, Number(pageSize ?? 20));
  return {
    ...rest,
    offset: (Math.max(1, Number(page ?? 1)) - 1) * limit,
    limit,
  };
}

/** Maps an offset-paged API list back to the console's page model. */
function toControlList<T>(
  response: ControlListResponse<T>,
  fallbackLimit: number,
): ControlList<T> {
  // An empty unpaged list reports a limit of 0.
  const reported = response.limit ?? 0;
  const limit = Math.max(1, reported > 0 ? reported : fallbackLimit);
  return {
    items: response.items ?? [],
    pagination: {
      page: Math.floor(Math.max(0, response.offset ?? 0) / limit) + 1,
      page_size: limit,
      total: Math.max(0, response.total ?? 0),
    },
  };
}

function controlPath(
  operation: string,
  parameters: Record<string, QueryValue> = {},
): string {
  const query = new URLSearchParams();
  Object.entries(toOffsetPaging(parameters)).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return `/api/operations/${operation}${query.size ? `?${query}` : ""}`;
}

export const controlApi = {
  list: async <T>(
    operation: string,
    parameters: Record<string, QueryValue> = {},
    signal?: AbortSignal,
  ): Promise<ControlList<T>> => {
    const response = await api<ControlListResponse<T>>(
      controlPath(operation, parameters),
      { signal },
    );
    return toControlList(response, Number(parameters.page_size ?? 20));
  },
  /** Reads one Harbor resource; a response without a body is undefined. */
  data: async <T>(
    operation: string,
    parameters: Record<string, QueryValue> = {},
    signal?: AbortSignal,
  ): Promise<T | undefined> => {
    const response = await api<T | null>(controlPath(operation, parameters), {
      signal,
    });
    return response ?? undefined;
  },
  mutate: <T>(input: ControlWriteOptions) =>
    api<T>(controlPath(input.operation, input.parameters), {
      method: input.method,
      body: input.payload,
      signal: input.signal,
      headers: input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : undefined,
    }),
};

export async function loadAllControlItems<T>(
  operation: string,
  parameters: Record<string, QueryValue> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  const maxCollectionItems = 10_000;
  const collectionPageSize = 100;
  for (
    let pageIndex = 0;
    pageIndex < maxCollectionItems / collectionPageSize;
    pageIndex += 1
  ) {
    const collection = await controlApi.list<T>(
      operation,
      { ...parameters, page, page_size: collectionPageSize },
      signal,
    );
    if (collection.items.length > collectionPageSize)
      throw new ApiError("collection page exceeds limit", {
        status: 0,
        code: "invalid_response",
        requestId: "",
        canRetry: false,
      });
    items.push(...collection.items);

    if (
      collection.items.length === 0 ||
      items.length >= collection.pagination.total
    ) {
      return items;
    }
    page += 1;
  }
  throw new ApiError("collection exceeds item limit", {
    status: 0,
    code: "collection_too_large",
    requestId: "",
    canRetry: false,
  });
}

export const sessionApi = {
  current: (signal?: AbortSignal) =>
    api<Session>("/api/sessions/current", { signal }),
  connect: (input: ConnectRequest, signal?: AbortSignal) =>
    api<Session>("/api/sessions", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": crypto.randomUUID() },
      signal,
    }),
  demo: (signal?: AbortSignal) =>
    api<Session>("/api/demo-sessions", {
      method: "POST",
      body: {},
      headers: { "Idempotency-Key": crypto.randomUUID() },
      signal,
    }),
  logout: (signal?: AbortSignal) =>
    api<null>("/api/sessions/current", { method: "DELETE", signal }),
};

async function publicCatalogList<T>(
  resource: "artifacts" | "projects" | "repositories",
  input: PublicCatalogRequest,
  signal?: AbortSignal,
): Promise<ControlList<T>> {
  const { page, page_size: pageSize, ...rest } = input;
  const response = await api<ControlListResponse<T>>(
    `/api/public/${resource}`,
    {
      method: "POST",
      body: { ...rest, offset: (page - 1) * pageSize, limit: pageSize },
      credentials: "omit",
      signal,
    },
  );
  return toControlList(response, pageSize);
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
    api<HarborInstanceCollection>("/api/instances", { signal }),
  add: (input: ConnectRequest, signal?: AbortSignal) =>
    api<Session>("/api/instances", {
      method: "POST",
      body: input,
      signal,
    }),
  addDemo: (signal?: AbortSignal) =>
    api<Session>("/api/instances/demo", {
      method: "POST",
      body: {},
      signal,
    }),
  switch: (id: string, signal?: AbortSignal) =>
    api<Session>("/api/instances/current", {
      method: "PUT",
      body: { id },
      signal,
    }),
  remove: (id: string, signal?: AbortSignal) =>
    api<Session>(`/api/instances/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal,
    }),
};

export const searchApi = {
  search: (term: string, signal?: AbortSignal) =>
    api<SearchResults>(`/api/search-results?q=${encodeURIComponent(term)}`, {
      signal,
    }),
};

export const dashboardApi = {
  load: (signal?: AbortSignal) =>
    api<Dashboard>("/api/dashboards/current", { signal }),
};

export const identityApi = {
  current: async (signal?: AbortSignal) => {
    return api<HarborIdentity>("/api/operations/current-user", { signal });
  },
  permissions: async (signal?: AbortSignal) => {
    const query = new URLSearchParams({ scope: "/", relative: "true" });
    const response = await api<ControlListResponse<HarborPermission>>(
      `/api/operations/current-permissions?${query}`,
      { signal },
    );
    return response.items ?? [];
  },
};

export type ControlWriteOptions = {
  operation: string;
  parameters: Record<string, QueryValue>;
  method: "DELETE" | "PATCH" | "POST" | "PUT";
  payload?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
};

/** Same-repository response boundary for TanStack's unknown mutation result. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- TanStack stores unknown; the API boundary restores the requested response type.
export function controlResult<T>(response: unknown): T {
  return response as T;
}
