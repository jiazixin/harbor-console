import type { DashboardWarning, Locale } from "./models";

/*
 * User-facing text for errors reported by the Go server. The server sends a
 * stable snake_case code with English developer text; the console shows the
 * text mapped from the code and never the server message. See docs/API.md.
 */

/** A Chinese text and its English translation. */
type Text = readonly [chinese: string, english: string];

/** The error object of a failed API response. */
export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type FieldProblem = { path: string; reason: string };

const invalidArgument: Text = ["请求参数无效", "Invalid request"];

const codeMessages: Partial<Record<string, Text>> = {
  collection_too_large: [
    "数据量超过单次载入上限，请缩小查询范围",
    "The collection exceeds the load limit. Narrow the query",
  ],
  demo_capacity: [
    "演示实例的编辑额度已用完，请重新进入演示",
    "The demo edit budget is exhausted. Start a new demo",
  ],
  unavailable: [
    "服务暂时不可用，请稍后重试",
    "Service temporarily unavailable. Try again later",
  ],
  network_unavailable: [
    "无法连接控制台服务，请检查网络后重试",
    "Cannot reach the console server. Check the network and try again",
  ],
  timeout: ["请求超时，请稍后重试", "The request timed out. Try again later"],
  invalid_response: [
    "服务返回了无法读取的响应，请重试",
    "The server returned an unreadable response. Try again",
  ],
  unauthenticated: [
    "会话已失效，请重新连接 Harbor",
    "Session expired. Reconnect to Harbor",
  ],
  permission_denied: [
    "请求来源无效，请从当前控制台提交请求",
    "Invalid request origin. Submit the request from this console",
  ],
  rate_limited: [
    "请求过于频繁，请稍后重试",
    "Too many requests. Try again later",
  ],
  query_too_long: [
    "查询参数过长，请缩短筛选条件后重试",
    "The query is too long. Shorten the filters and try again",
  ],
  not_found: ["请求的资源不存在", "The requested resource does not exist"],
  method_not_allowed: [
    "该操作不支持此请求方法",
    "This operation does not support the request method",
  ],
  unsupported_media_type: [
    "请求格式无效，请刷新页面后重试。",
    "The request format is invalid. Refresh the page and try again.",
  ],
  idempotency_key_reused: [
    "重复提交的请求与首次不同，请刷新后重试。",
    "The repeated request differs from the first one. Refresh and try again.",
  ],
  payload_too_large: [
    "请求内容超过 1 MiB 上限",
    "The request exceeds the 1 MiB limit",
  ],
  internal: [
    "服务端内部错误，请稍后重试",
    "Internal server error. Try again later",
  ],
  invalid_instance_id: [
    "实例标识无效，请选择已有 Harbor 实例",
    "Invalid instance ID. Select an existing Harbor instance",
  ],
  instance_not_found: [
    "实例不存在，该 Harbor 连接可能已被移除",
    "Instance not found. This Harbor connection may have been removed",
  ],
  instance_exists: [
    "实例已经连接，同一地址和账号无需重复添加",
    "Instance already connected. The same URL and account cannot be added twice",
  ],
  instance_limit_reached: [
    "实例数量已达上限，每个会话最多连接 {limit} 个实例",
    "Instance limit reached. Each session can connect to at most {limit} instances",
  ],
  last_instance: [
    "不能移除最后一个实例，如需结束会话，请使用断开连接",
    "Cannot remove the last instance. Use Disconnect to end the session",
  ],
  demo_data_missing: ["该资源尚无演示数据", "No demo data for this resource"],
  demo_unsupported: [
    "演示模式不支持该操作",
    "Demo mode does not support this operation",
  ],
  asset_details_incomplete: [
    "部分项目资产明细读取失败，排序数据可能不完整",
    "Some project asset details could not be read; sorting may be incomplete",
  ],
  harbor_write_unconfirmed: [
    "Harbor 已接受写入，最终状态未确认。请先刷新回读确认，再决定是否重试。确认失败原因：{reason}",
    "Harbor accepted the write, but the final state is unconfirmed. Refresh to confirm before retrying. Confirmation failed: {reason}",
  ],
  harbor_timeout: [
    "Harbor 请求超时，请稍后重试",
    "Harbor request timed out. Try again later",
  ],
  harbor_canceled: ["Harbor 请求已取消", "Harbor request canceled"],
  harbor_bad_request: [
    "请求不符合 Harbor API 要求",
    "The request does not meet Harbor API requirements",
  ],
  harbor_unauthorized: ["用户名或密码无效", "Invalid username or password"],
  harbor_forbidden: [
    "当前 Harbor 账号没有访问该资源的权限",
    "The Harbor account cannot access this resource",
  ],
  harbor_not_found: [
    "Harbor 未找到请求的资源",
    "Harbor could not find the requested resource",
  ],
  harbor_method_not_allowed: [
    "当前 Harbor 版本或资源状态不允许该操作",
    "This Harbor version or resource state does not allow the operation",
  ],
  harbor_conflict: [
    "资源已存在或当前状态发生冲突",
    "The resource already exists or its state conflicts",
  ],
  harbor_precondition_failed: [
    "Harbor 前置条件未满足",
    "Harbor precondition failed",
  ],
  harbor_unprocessable: [
    "Harbor 无法处理该操作",
    "Harbor cannot process the operation",
  ],
  harbor_rate_limited: [
    "Harbor 请求过于频繁，请稍后重试",
    "Too many Harbor requests. Try again later",
  ],
  harbor_server_error: [
    "Harbor 服务端错误（HTTP {harbor_status}），请检查 Harbor 日志，以及 Harbor 能否访问所填写的外部地址",
    "Harbor server error (HTTP {harbor_status}). Check the Harbor logs and whether Harbor can reach the external URLs you entered",
  ],
  harbor_error: [
    "Harbor 返回 {harbor_status}",
    "Harbor returned {harbor_status}",
  ],
  harbor_invalid_response: [
    "Harbor 返回的数据格式无效",
    "Harbor returned invalid data",
  ],
  harbor_readback_mismatch: [
    "Harbor 回读的数据与请求不一致",
    "The data read back from Harbor differs from the request",
  ],
  harbor_too_many_redirects: [
    "Harbor 地址发生了过多重定向",
    "The Harbor URL redirected too many times",
  ],
  harbor_redirect_refused: [
    "Harbor 将请求重定向到其他域名或协议，已为保护凭据而拒绝",
    "Harbor redirected to another host or scheme; the request was refused to protect credentials",
  ],
  harbor_certificate_invalid: [
    "Harbor 证书验证失败；请检查证书，或仅在可信内网启用自签名证书选项",
    "Harbor certificate verification failed. Check the certificate, or allow self-signed certificates only on a trusted network",
  ],
  harbor_unreachable: [
    "无法访问 Harbor 实例，请检查地址、网络和端口",
    "Cannot reach the Harbor instance. Check the URL, network and port",
  ],
  harbor_read_failed: [
    "读取 Harbor 响应失败，请稍后重试",
    "Reading the Harbor response failed. Try again later",
  ],
  harbor_unknown_error: [
    "Harbor 连接出现未知错误，请检查实例状态后重试",
    "Unknown Harbor connection error. Check the instance and try again",
  ],
};

/** Field problem texts; {field} is replaced with the field label. */
const reasonMessages: Partial<Record<string, Text>> = {
  required: ["{field} 不能为空", "{field} is required"],
  too_long: ["{field} 超过长度上限", "{field} is too long"],
  invalid_text: [
    "{field} 包含无效字符或长度超过上限",
    "{field} contains invalid characters or is too long",
  ],
  contains_whitespace: [
    "{field} 不能包含空格",
    "{field} cannot contain spaces",
  ],
  unknown_field: [
    "请求包含不允许的字段 {field}",
    "The request contains the disallowed field {field}",
  ],
  invalid_type: ["{field} 的类型不正确", "{field} has the wrong type"],
  invalid_json: ["{field} 必须是有效的 JSON", "{field} must be valid JSON"],
  body_required: ["缺少请求内容", "The request body is missing"],
  only_field: ["请求只能包含 {field}", "The request can contain only {field}"],
  not_boolean: ["{field} 必须是布尔值", "{field} must be a boolean"],
  not_boolean_or_null: [
    "{field} 必须是布尔值或 null",
    "{field} must be a boolean or null",
  ],
  not_boolean_string: [
    "{field} 必须是字符串 true 或 false",
    "{field} must be the string true or false",
  ],
  not_object: ["{field} 必须是 JSON 对象", "{field} must be a JSON object"],
  not_string: ["{field} 必须是文本", "{field} must be text"],
  not_positive_integer: [
    "{field} 必须是正整数",
    "{field} must be a positive integer",
  ],
  not_non_negative_integer: [
    "{field} 必须是 0 或正整数",
    "{field} must be 0 or a positive integer",
  ],
  not_minus_one_or_positive: [
    "{field} 必须是 -1 或正整数",
    "{field} must be -1 or a positive integer",
  ],
  out_of_range: ["{field} 超出允许范围", "{field} is out of range"],
  invalid_value: ["{field} 的取值不受支持", "{field} has an unsupported value"],
  invalid_count: [
    "{field} 的数量超出允许范围",
    "{field} has too few or too many entries",
  ],
  duplicate: ["{field} 包含重复项", "{field} contains a duplicate"],
  exactly_one_of: [
    "{field} 与相关字段必须且只能设置一个",
    "Set exactly one of {field} and the related field",
  ],
  invalid_url: [
    "{field} 必须是完整的 http:// 或 https:// URL",
    "{field} must be a complete http:// or https:// URL",
  ],
  invalid_ldap_url: [
    "{field} 必须是完整的 ldap:// 或 ldaps:// URL",
    "{field} must be a complete ldap:// or ldaps:// URL",
  ],
  url_has_credentials: [
    "{field} 不能包含凭据或片段",
    "{field} cannot contain credentials or a fragment",
  ],
  url_has_query: [
    "{field} 不能包含查询参数或片段",
    "{field} cannot contain a query string or fragment",
  ],
  url_has_path: [
    "Harbor 地址必须是实例根地址，不能包含路径前缀",
    "The Harbor URL must be the instance root without a path prefix",
  ],
  password_policy: [
    "{field} 必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字",
    "{field} must have 8 to 128 characters with an uppercase letter, a lowercase letter and a digit",
  ],
  invalid_cron: [
    "{field} 不是有效的 Cron 表达式",
    "{field} is not a valid cron expression",
  ],
  invalid_harbor_cron: [
    "定时复制必须使用以 0 开头的六段 Harbor Cron 表达式",
    "Scheduled replication needs a six-field Harbor cron expression starting with 0",
  ],
  cron_requires_schedule: [
    "非定时复制不能设置 Cron 表达式",
    "Only scheduled replication can set a cron expression",
  ],
  not_supported: [
    "{field} 不受 Harbor 官方 API 支持",
    "{field} is not supported by the Harbor API",
  ],
  read_only: [
    "{field} 是只读配置项，不能修改",
    "{field} is read-only and cannot be changed",
  ],
  invalid_uuid: ["{field} 必须是有效的 UUID", "{field} must be a valid UUID"],
  invalid_email: ["邮箱地址格式无效", "Invalid email address"],
  invalid_color: [
    "{field} 必须使用 #RRGGBB 格式",
    "{field} must use the #RRGGBB format",
  ],
  invalid_key: ["{field} 不是有效的名称", "{field} is not a valid name"],
  invalid_quota: [
    "配额值必须是 -1（不限制）或非负整数",
    "Quota values must be -1 (unlimited) or a non-negative integer",
  ],
  invalid_storage_limit: [
    "{field} 必须为 -1、0 或正整数",
    "{field} must be -1, 0 or a positive integer",
  ],
  invalid_role: [
    "角色必须是项目管理员、开发者、访客或维护者",
    "The role must be project admin, developer, guest or maintainer",
  ],
  invalid_group_type: [
    "组类型必须是 LDAP、HTTP 或 OIDC",
    "The group type must be LDAP, HTTP or OIDC",
  ],
  invalid_permission: [
    "{field} 必须包含 namespace 和 access",
    "{field} must contain namespace and access",
  ],
  invalid_duration: [
    "有效期必须是 -1（永不过期）或正整数",
    "The duration must be -1 (never expires) or a positive integer",
  ],
  invalid_timestamp: [
    "{field} 必须是正整数时间戳或 null",
    "{field} must be a positive integer timestamp or null",
  ],
  invalid_cve_id: [
    "{field} 的 CVE 编号格式无效",
    "{field} is not a valid CVE ID",
  ],
  exactly_one_project: [
    "CVE 导出必须选择且只能选择一个有效项目",
    "A CVE export needs exactly one valid project",
  ],
  invalid_workers: [
    "垃圾清理并行工作数必须是 1 到 10 的整数",
    "Garbage collection workers must be an integer from 1 to 10",
  ],
  invalid_retention_hours: [
    "审计日志保留时间必须是 1 到 87600000 小时之间的整数",
    "Audit log retention must be an integer from 1 to 87600000 hours",
  ],
  invalid_event_types: [
    "事件类型必须是逗号分隔的有效事件名称",
    "Event types must be a comma-separated list of valid event names",
  ],
  invalid_namespace: [
    "{field} 必须是 255 个字符以内的小写命名空间路径",
    "{field} must be a lowercase namespace path of at most 255 characters",
  ],
  deletion_requires_push_event: [
    "同步删除仅适用于推送方向的事件触发策略",
    "Deletion sync applies only to event-based push policies",
  ],
  not_supported_for_event_trigger: [
    "事件触发策略不支持单活执行",
    "Event-based policies do not support single active replication",
  ],
  invalid_speed: [
    "限速必须是 -1（不限速）或不超过 2147483647 的正整数 Kbps",
    "The speed limit must be -1 (unlimited) or a positive integer up to 2147483647 Kbps",
  ],
  invalid_registry_reference: [
    "{field} 必须是只包含 id 的对象或 null",
    "{field} must be an object with only id, or null",
  ],
  invalid_preheat_name: [
    "名称只能使用字母、数字及单个点、下划线或连字符分隔",
    "The name may contain only letters and digits separated by single dots, underscores or hyphens",
  ],
  invalid_date: [
    "{field} 必须是日期字符串或 null",
    "{field} must be a date string or null",
  ],
  invalid_search_term: [
    "{field} 必须是 1 到 255 个字符的单行搜索词",
    "{field} must be a single-line search term of 1 to 255 characters",
  ],
  search_term_too_short: [
    "搜索词至少需要两个字符",
    "Enter at least two characters",
  ],
  invalid_permission_scope: [
    "{field} 必须是以 / 开头且不含空白字符的权限范围",
    "{field} must be a permission scope that starts with / and has no whitespace",
  ],
  invalid_artifact_reference: [
    "{field} 必须是 project/repository:tag 或 project/repository@sha256:digest",
    "{field} must be project/repository:tag or project/repository@sha256:digest",
  ],
  path_traversal: [
    "{field} 不能包含路径跳转片段",
    "{field} cannot contain path traversal segments",
  ],
  too_many_values: [
    "{field} 参数重复次数过多",
    "{field} is repeated too often",
  ],
  repository_name_missing: [
    "repository 不能只包含项目名称",
    "repository cannot contain only the project name",
  ],
};

/** Texts for one reason at one path, keyed "path:reason" with indexes as *. */
const fieldReasonMessages: Partial<Record<string, Text>> = {
  "url:url_has_credentials": [
    "请在独立字段中输入用户名和密码",
    "Enter the username and password in their own fields",
  ],
  "member_user:exactly_one_of": [
    "必须且只能提供成员用户或成员组",
    "Provide exactly one of a member user and a member group",
  ],
  "groupname:exactly_one_of": [
    "组名称与组 DN 只能选择一个",
    "Choose either the group name or the group DN",
  ],
  "src_registry:exactly_one_of": [
    "源仓库与目标仓库必须且只能设置一个",
    "Set exactly one of the source and destination registries",
  ],
  "metadata.severity:invalid_value": [
    "漏洞阻止等级必须是 none、low、medium、high 或 critical",
    "The severity must be none, low, medium, high or critical",
  ],
  "dest_namespace_replace_count:invalid_value": [
    "命名空间替换层级必须是 -1、0、1、2 或 3",
    "The namespace replace count must be -1, 0, 1, 2 or 3",
  ],
};

/** Labels of request fields, keyed by their path. */
const fieldLabels: Partial<Record<string, Text>> = {
  url: ["地址", "URL"],
  username: ["用户名", "Username"],
  password: ["密码", "Password"],
  new_password: ["新密码", "New password"],
  old_password: ["旧密码", "Old password"],
  secret: ["密钥", "Secret"],
  name: ["名称", "Name"],
  project_name: ["项目名称", "Project name"],
  project: ["项目", "Project"],
  repository: ["仓库", "Repository"],
  description: ["描述", "Description"],
  email: ["邮箱", "Email"],
  realname: ["姓名", "Full name"],
  comment: ["备注", "Comment"],
  group_name: ["组名称", "Group name"],
  endpoint: ["地址", "Endpoint"],
  q: ["搜索词", "Search term"],
  query: ["搜索内容", "Search text"],
  page: ["页码", "Page"],
  page_size: ["每页数量", "Page size"],
  "member_user.username": ["成员用户名", "Member username"],
  "member_group.group_name": ["成员组名称", "Member group name"],
};

function pick(text: Text, locale: Locale): string {
  return locale === "en-US" ? text[1] : text[0];
}

function fill(
  template: string,
  values: Record<string, unknown>,
  locale: Locale,
): string {
  const filled = template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : match;
  });
  // Chinese templates put a space after {field} for ASCII field names; drop it
  // when the label is Chinese too.
  return locale === "en-US"
    ? filled.charAt(0).toUpperCase() + filled.slice(1)
    : filled.replace(/([㐀-鿿）]) (?=[㐀-鿿])/g, "$1");
}

function fieldLabel(path: string, locale: Locale): string {
  const label = fieldLabels[path];
  if (label) return pick(label, locale);
  // Show array indexes 1-based: rules.0.tag_selectors -> rules[1].tag_selectors.
  return path.replace(
    /\.(\d+)(?=\.|$)/g,
    (_, index: string) => `[${String(Number(index) + 1)}]`,
  );
}

function describeField(problem: FieldProblem, locale: Locale): string {
  const pattern = problem.path.replace(/\.\d+(?=\.|$)/g, ".*");
  const text =
    fieldReasonMessages[`${pattern}:${problem.reason}`] ??
    reasonMessages[problem.reason];
  if (!text) return pick(invalidArgument, locale);
  if (problem.path === "" && problem.reason === "invalid_json") {
    return locale === "en-US"
      ? "The request body must be one valid JSON object"
      : "请求体必须是一个有效的 JSON 对象";
  }
  return fill(
    pick(text, locale),
    { field: fieldLabel(problem.path, locale) },
    locale,
  );
}

function firstFieldProblem(details: Record<string, unknown> | undefined) {
  const fields = details?.fields;
  if (!Array.isArray(fields)) return undefined;
  const first: unknown = fields[0];
  if (!first || typeof first !== "object") return undefined;
  const { path, reason } = first as Record<string, unknown>;
  return typeof path === "string" && typeof reason === "string"
    ? { path, reason }
    : undefined;
}

/** Extracts the error object from a failed response body, if it has one. */
export function readApiErrorBody(payload: unknown): ApiErrorBody | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return undefined;
  const { code, message, details } = error as Record<string, unknown>;
  if (typeof code !== "string") return undefined;
  return {
    code,
    message: typeof message === "string" ? message : "",
    details:
      details && typeof details === "object"
        ? (details as Record<string, unknown>)
        : undefined,
  };
}

/** Returns the user-facing text for an API error in locale. */
export function describeApiError(
  error: ApiErrorBody | undefined,
  status: number,
  locale: Locale,
): string {
  if (!error) return genericFailure(status, locale);
  const details = error.details ?? {};
  if (error.code === "invalid_argument") {
    const problem = firstFieldProblem(error.details);
    return problem
      ? describeField(problem, locale)
      : pick(invalidArgument, locale);
  }
  const text = codeMessages[error.code];
  if (!text) return genericFailure(status, locale);
  const values: Record<string, unknown> = { ...details };
  if (error.code === "harbor_write_unconfirmed") {
    const reason = typeof details.reason === "string" ? details.reason : "";
    values.reason = describeApiError(
      {
        code: reason,
        message: "",
        details: { harbor_message: details.harbor_message },
      },
      0,
      locale,
    );
    return fill(pick(text, locale), values, locale);
  }
  const description = fill(pick(text, locale), values, locale);
  return description;
}

/** Returns the text of a dashboard warning, prefixed with its section. */
export function describeDashboardWarning(
  warning: DashboardWarning,
  locale: Locale,
): string {
  return `${warning.source}: ${describeApiError(warning, 0, locale)}`;
}

function genericFailure(status: number, locale: Locale): string {
  if (status === 0) {
    return locale === "en-US" ? "Request failed" : "请求失败";
  }
  return locale === "en-US"
    ? `Request failed (${String(status)})`
    : `请求失败（${String(status)}）`;
}

/** Every code and reason with a text, for contract tests. */
export const knownErrorCodes = [
  ...Object.keys(codeMessages),
  "invalid_argument",
];
export const knownFieldReasons = Object.keys(reasonMessages);
