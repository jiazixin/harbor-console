import {
  createEnglishTranslator,
  type MessageEntry,
} from "./message-templates";
import type { Locale } from "./models";

/*
 * English translations for messages produced by the Go server. The server
 * answers in Chinese; see message-templates.ts for the %s/%d template syntax.
 */
const serverMessages: readonly MessageEntry[] = [
  // Session, connection and request boundary errors.
  ["会话已失效", "Session expired"],
  ["请重新连接 Harbor", "Reconnect to Harbor"],
  ["请求来源无效", "Invalid request origin"],
  ["请从当前控制台提交连接请求", "Submit the connection from this console"],
  ["请从当前控制台提交请求", "Submit the request from this console"],
  ["请从当前控制台提交写操作", "Submit write operations from this console"],
  ["请从当前控制台浏览公开目录", "Browse the public catalog from this console"],
  ["连接尝试过于频繁", "Too many connection attempts"],
  ["请等待一分钟后重试", "Wait one minute and try again"],
  ["请求过于频繁", "Too many requests"],
  ["请稍后重试", "Try again later"],
  ["连接信息无效", "Invalid connection details"],
  ["无法连接 Harbor", "Cannot connect to Harbor"],
  ["无法创建会话", "Cannot create the session"],
  ["无法创建演示会话", "Cannot create the demo session"],
  ["随机会话标识生成失败", "Failed to generate a random session ID"],
  ["请输入 Harbor 用户名和密码", "Enter the Harbor username and password"],
  [
    "请检查 Harbor 地址和登录信息，字段长度超过限制",
    "Check the Harbor URL and sign-in details; a field is too long",
  ],
  ["尚未连接 Harbor", "Not connected to Harbor"],
  ["请先连接实例", "Connect to an instance first"],
  ["实例标识无效", "Invalid instance ID"],
  ["请选择已有 Harbor 实例", "Select an existing Harbor instance"],
  ["实例不存在", "Instance not found"],
  [
    "该 Harbor 连接可能已被移除",
    "This Harbor connection may have been removed",
  ],
  ["实例已经连接", "Instance already connected"],
  [
    "同一地址和账号无需重复添加",
    "The same URL and account cannot be added twice",
  ],
  ["实例数量已达上限", "Instance limit reached"],
  [
    "每个会话最多连接 %d 个实例",
    "Each session can connect to at most %d instances",
  ],
  ["不能移除最后一个实例", "Cannot remove the last instance"],
  ["如需结束会话，请使用断开连接", "Use Disconnect to end the session"],
  ["实例操作失败", "Instance operation failed"],
  ["无法更新当前会话", "Cannot update the current session"],
  ["请输入 Harbor 实例地址", "Enter the Harbor instance URL"],
  [
    "地址必须是完整的 http:// 或 https:// URL",
    "The URL must be a complete http:// or https:// URL",
  ],
  ["仅支持 http 和 https 协议", "Only http and https are supported"],
  [
    "请在独立字段中输入用户名和密码",
    "Enter the username and password in their own fields",
  ],
  [
    "地址不能包含查询参数或片段",
    "The URL cannot contain a query string or fragment",
  ],
  [
    "Harbor 地址必须是实例根地址，不能包含路径前缀",
    "The Harbor URL must be the instance root without a path prefix",
  ],
  ["Harbor 地址长度超过限制", "The Harbor URL is too long"],
  [
    "请求只能包含一个 JSON 对象",
    "The request can contain only one JSON object",
  ],

  // Upstream Harbor responses.
  ["Harbor 请求失败", "Harbor request failed"],
  [
    "Harbor 已接受写入，最终状态未确认",
    "Harbor accepted the change, but its final state is unconfirmed",
  ],
  ["确认请求超时", "the confirmation request timed out"],
  ["确认请求已取消", "the confirmation request was canceled"],
  [
    "请先刷新回读确认，再决定是否重试。确认失败原因：%s",
    "Refresh to confirm the result before retrying. Confirmation failed because %s",
  ],
  ["Harbor 请求超时，请稍后重试", "Harbor timed out; try again later"],
  ["Harbor 请求已取消", "Harbor request canceled"],
  ["用户名或密码无效", "Invalid username or password"],
  [
    "当前 Harbor 账号没有访问该资源的权限",
    "This Harbor account cannot access the resource",
  ],
  ["Harbor 未找到请求的资源", "Harbor could not find the requested resource"],
  [
    "请求不符合 Harbor API 要求：%s",
    "The request does not meet Harbor API requirements: %s",
  ],
  [
    "当前 Harbor 版本或资源状态不允许该操作",
    "This Harbor version or resource state does not allow the operation",
  ],
  [
    "资源已存在或当前状态发生冲突：%s",
    "The resource already exists or its state conflicts: %s",
  ],
  ["Harbor 前置条件未满足：%s", "A Harbor precondition is not met: %s"],
  ["Harbor 无法处理该操作：%s", "Harbor cannot process the operation: %s"],
  [
    "Harbor 请求过于频繁，请稍后重试",
    "Too many requests to Harbor; try again later",
  ],
  ["Harbor 返回 %d: %s", "Harbor returned %d: %s"],
  [
    "Harbor 服务端错误（HTTP %d）：%s。请检查 Harbor 日志，以及 Harbor 能否访问所填写的外部地址",
    "Harbor server error (HTTP %d): %s. Check the Harbor logs and whether Harbor can reach the external address you entered",
  ],
  ["Harbor 返回的数据格式无效", "Harbor returned data in an invalid format"],
  ["Harbor 地址发生了过多重定向", "The Harbor URL redirected too many times"],
  [
    "Harbor 将请求重定向到其他域名或协议，已为保护凭据而拒绝",
    "Harbor redirected to another host or scheme; the request was refused to protect credentials",
  ],
  [
    "Harbor 证书验证失败；请检查证书，或仅在可信内网启用自签名证书选项",
    "Harbor certificate verification failed. Check the certificate, or allow self-signed certificates only on a trusted network",
  ],
  [
    "无法访问 Harbor 实例，请检查地址、网络和端口",
    "Cannot reach the Harbor instance; check the URL, network and port",
  ],
  [
    "读取 Harbor 响应失败，请稍后重试",
    "Failed to read the Harbor response; try again later",
  ],
  [
    "Harbor 连接出现未知错误，请检查实例状态后重试",
    "Unknown Harbor connection error; check the instance and try again",
  ],
  ["Harbor 响应无效", "Invalid Harbor response"],
  [
    "列表接口没有返回 JSON 数组",
    "The list endpoint did not return a JSON array",
  ],
  [
    "部分项目资产明细读取失败，排序数据可能不完整",
    "Some project asset details failed to load; the ranking may be incomplete",
  ],

  // Gateway request validation.
  ["查询参数过长", "Query string too long"],
  ["请缩短筛选条件后重试", "Shorten the filters and try again"],
  ["未知控制操作", "Unknown operation"],
  [
    "该操作不在 Harbor 官方 API 允许列表中",
    "This operation is not in the allowed Harbor API list",
  ],
  ["操作方法不受支持", "Method not supported"],
  ["该资源不允许使用 %s", "This resource does not allow %s"],
  ["查询参数无效", "Invalid query parameters"],
  ["路径参数无效", "Invalid path parameters"],
  ["请求内容无效", "Invalid request body"],
  [
    "%s 不在该操作的允许参数中",
    "%s is not an allowed parameter for this operation",
  ],
  ["%s 必须是 0 或正整数", "%s must be 0 or a positive integer"],
  ["%s 必须是正整数", "%s must be a positive integer"],
  ["%s 不是允许的取值", "%s is not an allowed value"],
  [
    "repository 不能只包含项目名称",
    "repository cannot contain only the project name",
  ],
  ["%s 是必填参数", "%s is required"],
  [
    "%s 包含无效字符或长度过长",
    "%s contains invalid characters or is too long",
  ],
  ["%s 不能包含路径跳转片段", "%s cannot contain path traversal segments"],
  ["%s 参数重复次数过多", "%s is repeated too many times"],
  [
    "%s 参数包含无效字符或长度过长",
    "%s contains invalid characters or is too long",
  ],
  ["必须是 1 到 %d 之间的整数", "must be an integer from 1 to %d"],
  [
    "%s 必须是 1 到 255 个字符的单行搜索词",
    "%s must be a single-line search term of 1 to 255 characters",
  ],
  ["relative 必须是 true 或 false", "relative must be true or false"],
  [
    "scope 必须是以 / 开头且不含空白字符的权限范围",
    "scope must be a permission scope that starts with / and has no spaces",
  ],
  [
    "from 必须是 project/repository:tag 或 project/repository@sha256:digest",
    "from must be project/repository:tag or project/repository@sha256:digest",
  ],
  [
    "JSON 请求体超过 1 MiB 或读取失败",
    "The JSON body exceeds 1 MiB or could not be read",
  ],
  ["缺少 JSON 请求体", "Missing JSON body"],
  ["请求体必须是一个有效的 JSON 对象", "The body must be a valid JSON object"],
  ["请求体包含不允许的字段 %s", "The body contains the disallowed field %s"],
  [
    "%s 必须是完整的 http:// 或 https:// URL",
    "%s must be a complete http:// or https:// URL",
  ],
  ["%s 不能包含凭据或片段", "%s cannot contain credentials or a fragment"],
  ["%s不能为空", "%s cannot be empty"],
  [
    "%s 包含无效字符或超过 %d 个字符",
    "%s contains invalid characters or exceeds %d characters",
  ],
  ["%s不能包含空格", "%s cannot contain spaces"],
  ["%s 必须是布尔值", "%s must be a boolean"],
  [
    "%s 必须是文本且不能包含换行或控制字符",
    "%s must be text without line breaks or control characters",
  ],
  [
    "%s 必须是 %d 个 UTF-8 字节以内的文本",
    "%s must be text of at most %d UTF-8 bytes",
  ],
  [
    "%s 必须是只包含 id 的对象或 null",
    "%s must be an object with only id, or null",
  ],
  ["%s 无效：%s", "%s is invalid: %s"],
  ["%s.id 必须是正整数", "%s.id must be a positive integer"],

  // Resource and catalog handlers.
  ["公开目录请求过于频繁", "Too many public catalog requests"],
  ["公开目录请求无效", "Invalid public catalog request"],
  ["分页参数超出允许范围", "Pagination parameters are out of range"],
  [
    "搜索内容包含无效字符或长度过长",
    "The search contains invalid characters or is too long",
  ],
  ["未知公开目录资源", "Unknown public catalog resource"],
  ["未知资源", "Unknown resource"],
  [
    "该资源不在 Harbor 代理允许列表中",
    "This resource is not in the Harbor allow list",
  ],
  ["没有演示数据", "No demo data"],
  ["该资源尚无演示数据", "This resource has no demo data"],
  [
    "资源接口没有返回有效 JSON",
    "The resource endpoint did not return valid JSON",
  ],
  ["搜索词太短", "Search term too short"],
  ["至少输入两个字符", "Enter at least two characters"],
  ["搜索词太长", "Search term too long"],
  ["搜索词不能超过 200 个字符", "The search term cannot exceed 200 characters"],
  ["演示模式不支持该操作", "Demo mode does not support this operation"],

  // Field labels inserted into validation messages.
  ["用户名", "Username"],
  ["成员用户名", "Member username"],
  ["成员组名称", "Member group name"],
  ["机器人名称", "Robot name"],
  ["标签 id", "Label ID"],
  ["HTTP 认证地址", "HTTP authentication URL"],
  ["HTTP Token Review 地址", "HTTP token review URL"],
  ["Webhook 名称", "Webhook name"],
  ["LDAP 用户标识", "LDAP user ID"],
  ["P2P 实例名称", "P2P instance name"],
  ["P2P 实例地址", "P2P instance URL"],
  ["P2P 实例 id", "P2P instance ID"],
  ["预热策略名称", "Preheat policy name"],
  ["预热策略 %s", "Preheat policy %s"],
  ["远端仓库 id", "Remote registry ID"],
  ["扫描器名称", "Scanner name"],
  ["Tag 保留策略 scope.ref", "Tag retention policy scope.ref"],
  ["用户组名称", "User group name"],
  ["Tag 名称", "Tag name"],
  ["UAA 地址", "UAA URL"],
  ["OIDC 地址", "OIDC URL"],
  ["审计日志转发地址", "Audit log forwarding URL"],
  ["仓库", "Repository"],
  ["标签名称", "Label name"],
  ["项目名称", "Project name"],
  ["策略名称", "Policy name"],
  ["连接名称", "Connection name"],
  ["远端仓库", "Remote registry"],
  ["扫描器", "Scanner"],

  // Members, robots and users.
  [
    "必须且只能提供 member_user 或 member_group",
    "Provide exactly one of member_user or member_group",
  ],
  ["member_user 无效：%s", "member_user is invalid: %s"],
  ["member_group 无效：%s", "member_group is invalid: %s"],
  [
    "成员组类型必须是 LDAP、HTTP 或 OIDC",
    "The member group type must be LDAP, HTTP or OIDC",
  ],
  [
    "LDAP 成员组必须包含 ldap_group_dn",
    "An LDAP member group must include ldap_group_dn",
  ],
  [
    "role_id 必须是 1 到 4：项目管理员、开发者、访客或维护者",
    "role_id must be 1 to 4: project admin, developer, guest or maintainer",
  ],
  [
    "机器人 level 必须是 project 或 system",
    "The robot level must be project or system",
  ],
  [
    "机器人描述必须是 1024 个字符以内的文本",
    "The robot description must be at most 1024 characters",
  ],
  ["机器人 disable 必须是布尔值", "The robot disable field must be a boolean"],
  [
    "机器人有效期必须是 -1（永不过期）或正整数",
    "The robot duration must be -1 (never expires) or a positive integer",
  ],
  ["机器人 permissions 不能为空", "Robot permissions cannot be empty"],
  [
    "机器人 permission 必须是 JSON 对象",
    "Each robot permission must be a JSON object",
  ],
  [
    "机器人 permission 必须包含 namespace 和 access",
    "Each robot permission must include namespace and access",
  ],
  ["机器人密钥必须是文本", "The robot secret must be text"],
  [
    "机器人密钥包含无效字符或长度超过 255",
    "The robot secret contains invalid characters or exceeds 255 characters",
  ],
  ["用户密码%s", "The user password %s"],
  ["新密码%s", "The new password %s"],
  ["CLI Secret%s", "The CLI secret %s"],
  [
    "必须是 8 到 128 个字符，并至少包含一个大写字母、一个小写字母和一个数字",
    "must be 8 to 128 characters with at least one uppercase letter, one lowercase letter and one digit",
  ],
  ["旧密码长度超过限制", "The old password is too long"],
  ["邮箱地址格式无效", "Invalid email address"],
  ["sysadmin_flag 必须是布尔值", "sysadmin_flag must be a boolean"],
  [
    "用户组类型必须是 LDAP、HTTP 或 OIDC",
    "The user group type must be LDAP, HTTP or OIDC",
  ],
  ["LDAP 用户组必须填写组 DN", "An LDAP user group requires a group DN"],
  [
    "ldap_uid_list 必须包含 1 到 100 个 LDAP 用户标识",
    "ldap_uid_list must contain 1 to 100 LDAP user IDs",
  ],
  ["LDAP 用户标识必须是字符串", "LDAP user IDs must be strings"],
  [
    "ldap_uid_list 不能包含重复用户",
    "ldap_uid_list cannot contain duplicate users",
  ],
  [
    "groupname 与 groupdn 只能选择一个",
    "Use either groupname or groupdn, not both",
  ],
  ["verify_cert 必须是布尔值", "verify_cert must be a boolean"],

  // Artifacts, allowlists and CVE exports.
  [
    "仓库描述必须是 1024 字符以内的文本",
    "The repository description must be at most 1024 characters",
  ],
  [
    "scan_type 必须是 vulnerability 或 sbom",
    "scan_type must be vulnerability or sbom",
  ],
  [
    "CVE Allowlist 的 expires_at 必须是正整数时间戳或 null",
    "The CVE allowlist expires_at must be a positive timestamp or null",
  ],
  [
    "CVE Allowlist 的 id 必须是正整数",
    "The CVE allowlist id must be a positive integer",
  ],
  [
    "CVE Allowlist 的 project_id 必须是 0 或正整数",
    "The CVE allowlist project_id must be 0 or a positive integer",
  ],
  [
    "CVE Allowlist 的 items 必须是数量不超过 1000 的数组",
    "The CVE allowlist items must be an array of at most 1000 entries",
  ],
  ["第 %d 个 CVE 条目必须是 JSON 对象", "CVE entry %d must be a JSON object"],
  ["第 %d 个 CVE 条目无效：%s", "CVE entry %d is invalid: %s"],
  ["第 %d 个 CVE 编号格式无效", "CVE ID %d has an invalid format"],
  ["CVE 编号 %s 重复", "CVE ID %s is duplicated"],
  [
    "CVE 导出当前必须选择且只能选择一个有效项目",
    "A CVE export must select exactly one valid project",
  ],
  [
    "CVE 导出 labels 必须是数量不超过 100 的数组",
    "CVE export labels must be an array of at most 100 entries",
  ],
  [
    "CVE 导出 labels 只能包含正整数",
    "CVE export labels can contain only positive integers",
  ],
  [
    "CVE 导出的 %s 必须是 2048 个字符以内的单行文本",
    "The CVE export %s must be a single line of at most 2048 characters",
  ],
  ["CVE 导出执行不存在", "CVE export execution not found"],
  [
    "CVE 导出文件不存在或已过期",
    "The CVE export file does not exist or has expired",
  ],
  [
    "Harbor 回读的 CVE Allowlist 与请求不一致",
    "The CVE allowlist read back from Harbor does not match the request",
  ],
  [
    "Harbor 返回的 CVE Allowlist expires_at 无效",
    "Harbor returned an invalid CVE allowlist expires_at",
  ],
  [
    "Harbor 返回的 CVE Allowlist items 无效",
    "Harbor returned invalid CVE allowlist items",
  ],
  [
    "Harbor 返回的 CVE Allowlist 条目无效",
    "Harbor returned an invalid CVE allowlist entry",
  ],

  // System configuration.
  ["系统配置更新内容不能为空", "The configuration update cannot be empty"],
  [
    "self_registration 是 Harbor v2.15 的只读配置项，不能通过此 API 修改",
    "self_registration is read-only in Harbor 2.15 and cannot be changed through this API",
  ],
  [
    "系统配置项 %s 的类型或长度无效",
    "Configuration item %s has an invalid type or length",
  ],
  ["系统配置项 %s 必须是布尔值", "Configuration item %s must be a boolean"],
  ["系统配置项 %s 的数值无效", "Configuration item %s has an invalid number"],
  [
    "系统配置项 %s 不在控制台允许列表中",
    "Configuration item %s is not in the console allow list",
  ],
  [
    "认证模式必须是 db_auth、ldap_auth、uaa_auth、oidc_auth 或 http_auth",
    "The authentication mode must be db_auth, ldap_auth, uaa_auth, oidc_auth or http_auth",
  ],
  [
    "项目创建权限必须是 adminonly 或 everyone",
    "Project creation must be adminonly or everyone",
  ],
  [
    "机器人账号前缀必须是 255 个字符以内的单行文本",
    "The robot account prefix must be a single line of at most 255 characters",
  ],
  [
    "LDAP 地址必须是完整的 ldap:// 或 ldaps:// URL",
    "The LDAP URL must be a complete ldap:// or ldaps:// URL",
  ],
  [
    "横幅消息必须是 Harbor 官方 BannerMessage JSON",
    "The banner message must be Harbor BannerMessage JSON",
  ],
  ["横幅消息无效：%s", "Invalid banner message: %s"],
  [
    "横幅消息正文必须是 1 到 800 个字符",
    "The banner text must be 1 to 800 characters",
  ],
  [
    "横幅消息 closable 必须是布尔值",
    "The banner closable field must be a boolean",
  ],
  [
    "横幅消息类型必须是 success、info、warning 或 danger",
    "The banner type must be success, info, warning or danger",
  ],
  [
    "横幅消息 %s 必须是日期字符串或 null",
    "The banner %s must be a date string or null",
  ],

  // Immutable tags, webhooks, retention and schedules.
  [
    "不可变规则必须包含 tag_selectors",
    "An immutable rule must include tag_selectors",
  ],
  [
    "不可变规则必须包含 scope_selectors",
    "An immutable rule must include scope_selectors",
  ],
  [
    "不可变规则必须包含 repository 范围",
    "An immutable rule must include a repository scope",
  ],
  ["%s 选择器必须是 JSON 对象", "The %s selector must be a JSON object"],
  [
    "%s 匹配规则不能为空或超过 1024 个字符",
    "The %s pattern cannot be empty or exceed 1024 characters",
  ],
  [
    "Webhook 必须至少包含一个 target",
    "A webhook must include at least one target",
  ],
  ["Webhook target 数量不能超过 10", "A webhook can have at most 10 targets"],
  [
    "Webhook target 必须是 JSON 对象",
    "Each webhook target must be a JSON object",
  ],
  [
    "Webhook 目标地址必须是完整的 http:// 或 https:// URL，且不能包含凭据",
    "The webhook endpoint must be a complete http:// or https:// URL without credentials",
  ],
  [
    "Webhook Authorization 请求头包含无效字符或长度过长",
    "The webhook Authorization header contains invalid characters or is too long",
  ],
  ["Webhook 必须至少选择一种事件", "Select at least one webhook event"],
  ["Webhook 事件类型数量过多", "Too many webhook event types"],
  [
    "Tag 保留策略 algorithm 必须是 or 或 and",
    "The tag retention algorithm must be or or and",
  ],
  [
    "Tag 保留策略必须包含 1 到 100 条 rules",
    "A tag retention policy must have 1 to 100 rules",
  ],
  [
    "第 %d 条 Tag 保留规则必须是 JSON 对象",
    "Tag retention rule %d must be a JSON object",
  ],
  ["第 %d 条 Tag 保留规则无效：%s", "Tag retention rule %d is invalid: %s"],
  [
    "Tag 保留策略 trigger.kind 必须是 Schedule",
    "The tag retention trigger.kind must be Schedule",
  ],
  [
    "Tag 保留策略 trigger.settings 必须是 JSON 对象",
    "The tag retention trigger.settings must be a JSON object",
  ],
  [
    "Tag 保留策略 Cron 表达式无效或过长",
    "The tag retention cron expression is invalid or too long",
  ],
  [
    "Tag 保留策略 scope 必须引用有效项目",
    "The tag retention scope must reference a valid project",
  ],
  ["disabled 必须是布尔值", "disabled must be a boolean"],
  ["action 必须是 retain", "action must be retain"],
  [
    "template 不能为空或超过 255 个字符",
    "template cannot be empty or exceed 255 characters",
  ],
  [
    "params 必须是参数数量不超过 32 的 JSON 对象",
    "params must be a JSON object with at most 32 entries",
  ],
  [
    "tag_selectors 必须包含 1 到 32 个选择器",
    "tag_selectors must contain 1 to 32 selectors",
  ],
  ["scope_selectors 必须是 JSON 对象", "scope_selectors must be a JSON object"],
  [
    "repository 范围必须包含 1 到 32 个选择器",
    "The repository scope must contain 1 to 32 selectors",
  ],
  [
    "%s 选择器 kind 必须是 doublestar",
    "The %s selector kind must be doublestar",
  ],
  [
    "%s 选择器 decoration 不受 Harbor 官方 API 支持",
    "The %s selector decoration is not supported by the Harbor API",
  ],
  [
    "%s 选择器 extras 必须是 4096 字符以内的 JSON 字符串",
    "The %s selector extras must be a JSON string of at most 4096 characters",
  ],
  [
    "%s 选择器 extras 必须包含有效的 JSON 对象",
    "The %s selector extras must contain a valid JSON object",
  ],
  [
    "%s 选择器 extras.untagged 必须是布尔值",
    "The %s selector extras.untagged must be a boolean",
  ],
  [
    "Tag 保留执行请求只能包含 dry_run",
    "A tag retention run request can contain only dry_run",
  ],
  ["dry_run 必须是布尔值", "dry_run must be a boolean"],
  [
    "Tag 保留执行操作只支持 stop",
    "A tag retention execution supports only stop",
  ],
  [
    "任务计划必须包含 schedule 对象",
    "The schedule must include a schedule object",
  ],
  [
    "任务计划类型不受 Harbor 官方 API 支持",
    "The schedule type is not supported by the Harbor API",
  ],
  [
    "自定义任务计划必须包含有效的 Cron 表达式",
    "A custom schedule must include a valid cron expression",
  ],

  // Labels, quotas, maintenance and job service.
  ["标签颜色必须使用 #RRGGBB 格式", "Label colors must use the #RRGGBB format"],
  ["标签 scope 必须是 g 或 p", "The label scope must be g or p"],
  ["配额必须包含 hard 资源限制", "A quota must include hard limits"],
  [
    "配额值必须是 -1（不限制）或非负整数",
    "A quota value must be -1 (unlimited) or a non-negative integer",
  ],
  [
    "垃圾清理参数必须是 JSON 对象",
    "Garbage collection parameters must be a JSON object",
  ],
  [
    "垃圾清理参数 %s 必须是布尔值",
    "Garbage collection parameter %s must be a boolean",
  ],
  [
    "垃圾清理并行工作数必须是 1 到 10 的整数",
    "Garbage collection workers must be an integer from 1 to 10",
  ],
  [
    "审计日志清理必须包含 parameters 对象",
    "An audit log purge must include a parameters object",
  ],
  [
    "审计日志保留时间必须是 1 到 87600000 小时之间的整数",
    "Audit log retention must be an integer from 1 to 87600000 hours",
  ],
  [
    "审计日志清理 dry_run 必须是布尔值",
    "The audit log purge dry_run must be a boolean",
  ],
  [
    "审计日志清理事件类型必须是逗号分隔的有效事件名称",
    "Audit log purge event types must be valid comma-separated event names",
  ],
  [
    "Job Service 队列操作只能包含 action",
    "A job queue operation can contain only action",
  ],
  [
    "Job Service 队列操作只支持 stop、pause 或 resume",
    "Job queue operations support only stop, pause or resume",
  ],

  // P2P preheat.
  [
    "P2P 实例名称只能使用字母、数字及单个点、下划线或连字符分隔",
    "P2P instance names can use letters and digits separated by single dots, underscores or hyphens",
  ],
  [
    "P2P 实例描述不能超过 1024 个字符",
    "The P2P instance description cannot exceed 1024 characters",
  ],
  ["P2P 认证模式无效", "Invalid P2P authentication mode"],
  ["P2P auth_info 必须是 JSON 对象", "P2P auth_info must be a JSON object"],
  [
    "P2P 凭据字段必须是长度受限的文本",
    "P2P credential fields must be text of limited length",
  ],
  [
    "预热策略名称只能使用字母、数字及单个点、下划线或连字符分隔",
    "Preheat policy names can use letters and digits separated by single dots, underscores or hyphens",
  ],
  ["预热策略 provider_id", "Preheat policy provider_id"],
  [
    "预热策略 %s 必须是 65536 个字符以内的文本",
    "The preheat policy %s must be text of at most 65536 characters",
  ],
  [
    "预热策略 filters 必须是非空 JSON 数组",
    "Preheat policy filters must be a non-empty JSON array",
  ],
  [
    "预热策略包含不支持的筛选类型",
    "The preheat policy contains an unsupported filter type",
  ],
  [
    "预热策略筛选条件缺少 value",
    "A preheat policy filter is missing its value",
  ],
  [
    "预热策略 trigger 必须包含有效的官方触发类型",
    "The preheat policy trigger must use a valid Harbor trigger type",
  ],
  [
    "定时预热策略必须包含 Cron 表达式",
    "A scheduled preheat policy must include a cron expression",
  ],
  [
    "预热策略 extra_attrs 必须是 JSON 对象",
    "The preheat policy extra_attrs must be a JSON object",
  ],
  [
    "预热策略 enabled 必须是布尔值",
    "The preheat policy enabled field must be a boolean",
  ],
  [
    "停止预热执行时 status 必须是 Stopped",
    "status must be Stopped when stopping a preheat execution",
  ],

  // Projects and scanners.
  ["public 必须是布尔值或 null", "public must be a boolean or null"],
  ["metadata 必须是 JSON 对象", "metadata must be a JSON object"],
  ["cve_allowlist 必须是 JSON 对象", "cve_allowlist must be a JSON object"],
  [
    "storage_limit 必须为 -1、0 或正整数",
    "storage_limit must be -1, 0 or a positive integer",
  ],
  [
    "registry_id 必须是 0 或正整数",
    "registry_id must be 0 or a positive integer",
  ],
  ["项目 metadata.%s 名称无效", "Project metadata.%s has an invalid name"],
  [
    "项目 metadata.%s 必须是长度受限的字符串",
    "Project metadata.%s must be a string of limited length",
  ],
  [
    "项目 metadata.%s 必须是字符串 true 或 false",
    'Project metadata.%s must be the string "true" or "false"',
  ],
  [
    "项目 metadata.severity 必须是 none、low、medium、high 或 critical",
    "Project metadata.severity must be none, low, medium, high or critical",
  ],
  [
    "项目 metadata.%s 必须是 32 个字符以内的单行字符串",
    "Project metadata.%s must be a single line of at most 32 characters",
  ],
  [
    "项目 metadata.%s 必须是 -1 或正整数",
    "Project metadata.%s must be -1 or a positive integer",
  ],
  [
    "metadata value 必须是不超过 4096 字符的字符串",
    "A metadata value must be a string of at most 4096 characters",
  ],
  ["扫描器 uuid 必须是有效的 UUID", "The scanner uuid must be a valid UUID"],
  [
    "扫描器描述必须是 1024 个字符以内的文本",
    "The scanner description must be at most 1024 characters",
  ],
  [
    "扫描器地址不能超过 512 个字符",
    "The scanner URL cannot exceed 512 characters",
  ],
  [
    "扫描器认证方式不受 Harbor Scanner Adapter API 支持",
    "The scanner authentication is not supported by the Harbor Scanner Adapter API",
  ],
  [
    "扫描器访问凭据不能超过 512 个字符或包含控制字符",
    "Scanner credentials cannot exceed 512 characters or contain control characters",
  ],
  ["扫描器 %s 必须是布尔值", "Scanner %s must be a boolean"],
  ["is_default 必须是布尔值", "is_default must be a boolean"],

  // Replication and remote registries.
  [
    "策略描述必须是 1024 个字符以内的文本",
    "The policy description must be at most 1024 characters",
  ],
  [
    "src_registry 与 dest_registry 必须且只能设置一个",
    "Set exactly one of src_registry and dest_registry",
  ],
  [
    "dest_namespace 必须是 255 个字符以内的小写命名空间路径",
    "dest_namespace must be a lowercase namespace path of at most 255 characters",
  ],
  [
    "dest_namespace_replace_count 必须是 -1、0、1、2 或 3",
    "dest_namespace_replace_count must be -1, 0, 1, 2 or 3",
  ],
  [
    "同步删除仅适用于推送方向的事件触发策略",
    "Delete synchronization applies only to event-based push policies",
  ],
  [
    "事件触发策略不支持单活执行",
    "Event-based policies do not support single active execution",
  ],
  [
    "speed 必须是 -1（不限速）或不超过 2147483647 的正整数 Kbps",
    "speed must be -1 (unlimited) or a positive integer up to 2147483647 Kbps",
  ],
  ["trigger 必须是 JSON 对象", "trigger must be a JSON object"],
  ["trigger 无效：%s", "Invalid trigger: %s"],
  [
    "trigger.type 必须是 manual、event_based 或 scheduled",
    "trigger.type must be manual, event_based or scheduled",
  ],
  [
    "trigger.trigger_settings 必须是 JSON 对象",
    "trigger.trigger_settings must be a JSON object",
  ],
  ["trigger.trigger_settings 无效：%s", "Invalid trigger.trigger_settings: %s"],
  [
    "trigger.trigger_settings.cron 必须是 255 个字符以内的单行文本",
    "trigger.trigger_settings.cron must be a single line of at most 255 characters",
  ],
  [
    "定时复制必须使用以 0 开头的六段 Harbor Cron 表达式",
    "Scheduled replication requires a six-field Harbor cron expression that starts with 0",
  ],
  [
    "非定时复制不能设置 Cron 表达式",
    "Only scheduled replication can set a cron expression",
  ],
  [
    "filters 必须是数量不超过 16 的数组",
    "filters must be an array of at most 16 entries",
  ],
  [
    "第 %d 个复制筛选器必须是 JSON 对象",
    "Replication filter %d must be a JSON object",
  ],
  ["第 %d 个复制筛选器无效：%s", "Replication filter %d is invalid: %s"],
  [
    "第 %d 个复制筛选器 type 不受 Harbor 复制 API 支持",
    "Replication filter %d uses a type the Harbor replication API does not support",
  ],
  [
    "复制筛选器 type %s 不能重复",
    "Replication filter type %s cannot be repeated",
  ],
  [
    "第 %d 个复制筛选器 decoration 必须是 matches 或 excludes",
    "Replication filter %d decoration must be matches or excludes",
  ],
  [
    "第 %d 个标签筛选器 value 必须是 1 到 100 个标签名称的数组",
    "Label filter %d value must be an array of 1 to 100 label names",
  ],
  [
    "第 %d 个标签筛选器包含无效标签名称",
    "Label filter %d contains an invalid label name",
  ],
  [
    "第 %d 个复制筛选器 value 必须是 1024 个字符以内的非空文本",
    "Replication filter %d value must be non-empty text of at most 1024 characters",
  ],
  ["必须选择远端仓库类型", "Select a remote registry type"],
  [
    "远端仓库地址必须是完整的 http:// 或 https:// URL",
    "The remote registry URL must be a complete http:// or https:// URL",
  ],
  [
    "远端仓库地址不能包含凭据或片段",
    "The remote registry URL cannot contain credentials or a fragment",
  ],

  // Demo gateway responses.
  [
    "Tag 保留策略引用的项目不存在",
    "The project referenced by the tag retention policy does not exist",
  ],
  [
    "项目已经绑定 Tag 保留策略",
    "The project already has a tag retention policy",
  ],
  ["Tag 保留策略不存在", "Tag retention policy not found"],
  ["Tag 保留执行记录不存在", "Tag retention execution not found"],
  ["Tag 保留任务日志不存在", "Tag retention task log not found"],
  ["垃圾清理任务不存在", "Garbage collection job not found"],
  ["审计日志清理任务不存在", "Audit log purge job not found"],
  ["审计日志清理日志不存在", "Audit log purge log not found"],
  ["Job Service 工作池不存在", "Job service pool not found"],
  ["运行任务不存在", "Running job not found"],
  ["Job Service 任务日志不存在", "Job log not found"],
  ["Job Service 队列不存在", "Job queue not found"],
  ["目标仓库不存在", "Target repository not found"],
  ["复制源格式无效", "Invalid copy source"],
  ["复制源制品不存在", "Source artifact not found"],
  [
    "目标仓库中已经存在该制品",
    "The artifact already exists in the target repository",
  ],
  ["Tag 已存在", "Tag already exists"],
  ["Tag 不存在", "Tag not found"],
  ["不可变 Tag 不能删除", "Immutable tags cannot be deleted"],
  ["标签不存在", "Label not found"],
  ["标签已经绑定到该制品", "The label is already attached to the artifact"],
  ["不能绑定其他项目的标签", "Labels from another project cannot be attached"],
  ["制品未绑定该标签", "The label is not attached to the artifact"],
  ["制品图标不存在", "Artifact icon not found"],
  ["当前制品没有该附加信息", "This artifact does not provide that addition"],
  ["机器人账号不存在", "Robot account not found"],
  ["项目标签不存在", "Project label not found"],
  ["当前用户不存在", "Current user not found"],
  ["用户名已经存在", "Username already exists"],
  ["用户不存在", "User not found"],
  [
    "不能删除当前演示管理员",
    "The current demo administrator cannot be deleted",
  ],
  ["用户组不存在", "User group not found"],
  ["不可变 Tag 规则不存在", "Immutable tag rule not found"],
  ["P2P 实例名称已经存在", "P2P instance name already exists"],
  ["P2P 实例地址已经注册", "P2P instance URL already registered"],
  ["P2P 实例不存在", "P2P instance not found"],
  [
    "该 P2P 实例仍被预热策略使用",
    "This P2P instance is still used by preheat policies",
  ],
  ["P2P Provider 无法连接", "Cannot reach the P2P provider"],
  ["预热策略名称已经存在", "Preheat policy name already exists"],
  ["预热策略不存在", "Preheat policy not found"],
  ["预热执行记录不存在", "Preheat execution not found"],
  ["预热任务日志不存在", "Preheat task log not found"],
  ["同名项目已经存在", "A project with this name already exists"],
  ["项目不存在", "Project not found"],
  [
    "项目仍包含仓库，请先删除仓库",
    "The project still has repositories; delete them first",
  ],
  ["扫描器不存在或已停用", "Scanner not found or disabled"],
  ["项目扫描器不存在", "Project scanner not found"],
  ["该成员已经在项目中", "This member is already in the project"],
  ["项目成员不存在", "Project member not found"],
  ["metadata key 不能为空", "The metadata key cannot be empty"],
  ["metadata 不存在", "Metadata not found"],
  ["配额不存在", "Quota not found"],
  ["远端仓库不存在", "Remote registry not found"],
  ["复制策略不存在", "Replication policy not found"],
  ["复制执行记录不存在", "Replication execution not found"],
  ["复制任务日志不存在", "Replication task log not found"],
  ["扫描器不存在", "Scanner not found"],
  ["默认扫描器不能直接删除", "The default scanner cannot be deleted"],
  ["Webhook 不存在", "Webhook not found"],
  ["Webhook 策略不存在", "Webhook policy not found"],
  ["Webhook 执行记录不存在", "Webhook execution not found"],
  ["Webhook 任务日志不存在", "Webhook task log not found"],
  ["扫描报告数据暂不可用", "Scan report data is not available yet"],
  ["LDAP 服务连接成功", "Connected to the LDAP server"],
  ["从 LDAP 目录导入", "Imported from the LDAP directory"],
  ["仓库不存在", "Repository not found"],
  ["制品不存在", "Artifact not found"],
];

const translateEnglish = createEnglishTranslator(serverMessages);

export function translateServerMessage(
  message: string,
  locale: Locale,
): string {
  return locale === "en-US" ? translateEnglish(message) : message;
}
