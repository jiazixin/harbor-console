export type Locale = "zh-CN" | "en-US";

export type ApiErrorPayload = {
  error?: string;
  details?: string;
};

export type Session = {
  connection_id: string;
  instance_url: string;
  username: string;
  demo: boolean;
  instance_count: number;
  expires_at: string;
};

export type HarborInstance = {
  connection_id: string;
  instance_url: string;
  username: string;
  demo: boolean;
  active: boolean;
  added_at?: string;
};

export type HarborInstanceCollection = {
  active_id: string;
  items: HarborInstance[];
  expires_at: string;
};

export type SearchProject = {
  name: string;
  project_id?: number;
  public?: boolean;
};

export type SearchRepository = {
  repository_name: string;
  project_name?: string;
  project_id?: number;
  artifact_count?: number;
  pull_count?: number;
};

export type SearchResults = {
  project?: SearchProject[];
  repository?: SearchRepository[];
};

export type ConnectRequest = {
  url: string;
  username: string;
  password: string;
  skip_tls_verify: boolean;
};

export type PublicCatalogLevel = "projects" | "repositories" | "artifacts";

export type PublicCatalogRequest = {
  url: string;
  skip_tls_verify: boolean;
  project: string;
  repository: string;
  page: number;
  page_size: number;
  query: string;
};

export type PublicCatalogState = PublicCatalogRequest & {
  level: PublicCatalogLevel;
  depth: number;
};

export type HarborHealth = {
  status?: string;
  components?: { name?: string; status?: string }[];
};

export type HarborSystemInfo = {
  harbor_version?: string;
  banner_message?: string;
  auth_mode?: string;
  has_ca_root?: boolean;
  registry_url?: string;
  project_creation_restriction?: string;
  self_registration?: boolean;
  read_only?: boolean;
};

export type SystemVolumes = {
  storage?: { total?: number; free?: number }[];
};

export type AboutPayload = {
  console?: {
    name?: string;
    version?: string;
    commit?: string;
    build_date?: string;
    deployment?: string;
    offline?: boolean;
  };
  harbor?: {
    target_version?: string;
    api_version?: string;
    license?: { name?: string; spdx?: string };
  };
};

export type ProjectMetadata = {
  public?: string;
  enable_content_trust?: string;
  enable_content_trust_cosign?: string;
  auto_scan?: string;
  prevent_vul?: string;
  severity?: string;
  auto_sbom_generation?: string;
  reuse_sys_cve_allowlist?: string;
  retention_id?: string;
  proxy_speed_kb?: string;
  max_upstream_conn?: string;
  proxy_cache_local_on_not_found?: string;
  proxy_referrer_api?: string;
  [key: string]: string | undefined;
};

export type CveAllowlist = {
  id?: number;
  project_id?: number;
  expires_at?: number | null;
  items?: { cve_id?: string }[];
  creation_time?: string;
  update_time?: string;
};

export type SecurityDangerousCve = {
  cve_id?: string;
  severity?: string;
  cvss_score_v3?: number;
  package?: string;
  version?: string;
  desc?: string;
};

export type SecurityVulnerability = {
  cve_id?: string;
  severity?: string;
  cvss_v3_score?: number;
  repository_name?: string;
  project_id?: number;
  digest?: string;
  tags?: string[];
  package?: string;
  version?: string;
  fixed_version?: string;
  status?: string;
  desc?: string;
};

export type SecurityDangerousArtifact = {
  project_id?: number;
  repository_name?: string;
  digest?: string;
  critical_cnt?: number;
  high_cnt?: number;
  medium_cnt?: number;
};

export type SecuritySummary = {
  scanned_cnt?: number;
  total_artifact?: number;
  total_vuls?: number;
  fixable_cnt?: number;
  critical_cnt?: number;
  high_cnt?: number;
  medium_cnt?: number;
  low_cnt?: number;
  dangerous_cves?: SecurityDangerousCve[];
  dangerous_artifacts?: SecurityDangerousArtifact[];
};

export type CveExportExecution = {
  id: number;
  user_id?: number;
  user_name?: string;
  status?: string;
  trigger?: string;
  start_time?: string;
  end_time?: string;
  status_text?: string;
  file_present?: boolean;
};

export type ScannerRegistration = {
  uuid: string;
  name?: string;
  description?: string;
  url?: string;
  auth?: string;
  disabled?: boolean;
  is_default?: boolean;
  skip_certVerify?: boolean;
  use_internal_addr?: boolean;
  health?: string;
  adapter?: string;
  vendor?: string;
  version?: string;
  create_time?: string;
  update_time?: string;
};

export type ScannerMetadata = {
  scanner?: {
    name?: string;
    vendor?: string;
    version?: string;
  };
  capabilities?: {
    type?: string;
    consumes_mime_types?: string[];
    produces_mime_types?: string[];
  }[];
  properties?: Record<string, string>;
};

export type ProjectSummary = {
  project_id?: number;
  name: string;
  owner_name?: string;
  registry_id?: number;
  metadata?: ProjectMetadata;
  cve_allowlist?: CveAllowlist;
  repo_count?: number;
  artifact_count?: number;
  tag_count?: number;
  storage_used?: number;
  creation_time?: string;
  update_time?: string;
};

export type ProjectScanner = {
  uuid: string;
  name?: string;
  adapter?: string;
  disabled?: boolean;
  is_default?: boolean;
};

export type Registry = {
  id?: number;
  name?: string;
  type?: string;
  url?: string;
  description?: string;
  status?: string;
  insecure?: boolean;
  ca_certificate?: string;
  credential?: {
    type?: string;
    access_key?: string;
  };
  creation_time?: string;
  update_time?: string;
};

export type RegistryAdapterEndpoint = {
  key?: string;
  value?: string;
};

export type RegistryAdapterInfo = {
  endpoint_pattern?: {
    endpoint_type?: string;
    endpoints?: RegistryAdapterEndpoint[];
  };
  credential_pattern?: {
    access_key_type?: string;
    access_key_data?: string;
    access_secret_type?: string;
  };
};

export type ReplicationResourceFilterStyle = {
  type?: "label" | "name" | "resource" | "tag";
  style?: string;
  values?: string[];
};

export type ReplicationAdapterInfo = {
  type?: string;
  supported_resource_filters?: ReplicationResourceFilterStyle[];
  supported_triggers?: string[];
  supported_copy_by_chunk?: boolean;
};

export type ProjectQuota = {
  id: number;
  ref?: {
    id?: number;
    name?: string;
    owner_name?: string;
  };
  hard?: { storage?: number; [key: string]: number | undefined };
  used?: { storage?: number; [key: string]: number | undefined };
  creation_time?: string;
  update_time?: string;
};

export type ProjectDetailSummary = {
  repo_count?: number;
  artifact_count?: number;
  project_admin_count?: number;
  maintainer_count?: number;
  developer_count?: number;
  guest_count?: number;
};

export type ProjectMember = {
  id: number;
  project_id?: number;
  entity_id?: number;
  entity_name: string;
  entity_type?: string;
  role_id?: number;
  role_name?: string;
};

export type HarborDirectoryUser = {
  user_id?: number;
  username: string;
  realname?: string;
  email?: string;
};

export type HarborDirectoryGroup = {
  id?: number;
  group_name?: string;
  group_type?: number;
  ldap_group_dn?: string;
};

export type HarborUser = {
  user_id: number;
  username: string;
  realname?: string;
  email?: string;
  comment?: string;
  sysadmin_flag?: boolean;
  admin_role_in_auth?: boolean;
  creation_time?: string;
  update_time?: string;
};

export type HarborUserGroup = {
  id: number;
  group_name: string;
  group_type?: number;
  ldap_group_dn?: string;
};

export type RobotAccess = {
  resource: string;
  action: string;
  effect?: string;
};

export type RobotPermission = {
  kind?: string;
  namespace?: string;
  access?: RobotAccess[];
};

export type ProjectRobot = {
  id: number;
  name: string;
  description?: string;
  level?: string;
  duration?: number;
  disable?: boolean;
  expires_at?: number;
  project_id?: number;
  permissions?: RobotPermission[];
  creation_time?: string;
  update_time?: string;
};

export type SystemRobot = ProjectRobot & {
  level: "system";
};

export type HarborSchedule = {
  type?: string;
  cron?: string;
  next_scheduled_time?: string;
};

export type HarborScheduleConfiguration = {
  id?: number;
  status?: string;
  schedule?: HarborSchedule;
  parameters?: Record<string, unknown>;
  job_parameters?: Record<string, unknown> | string;
  load_error?: string;
};

export type GarbageCollectionJob = {
  id: number;
  deleted?: boolean;
  dry_run?: boolean;
  job_name?: string;
  job_kind?: string;
  job_status?: string;
  job_parameters?: Record<string, unknown> | string;
  schedule?: HarborSchedule;
  creation_time?: string;
  update_time?: string;
};

export type AuditPurgeJob = {
  id: number;
  job_name?: string;
  job_kind?: string;
  job_status?: string;
  job_parameters?: Record<string, unknown> | string;
  parameters?: Record<string, unknown>;
  creation_time?: string;
  update_time?: string;
};

export type ScanAllMetrics = {
  total?: number;
  completed?: number;
  metrics?: Record<string, number>;
  load_error?: string;
};

export type JobServicePool = {
  pid?: number;
  worker_pool_id: string;
  host?: string;
  concurrency?: number;
  start_at?: string;
  heartbeat_at?: string;
};

export type JobServiceWorker = {
  id: string;
  pool_id?: string;
  job_name?: string;
  job_id?: string;
  check_in?: string;
  start_at?: string;
  checkin_at?: string;
};

export type JobServiceQueue = {
  job_type: string;
  count?: number;
  latency?: number;
  paused?: boolean;
};

export type JobServiceSchedule = {
  id: number;
  vendor_type?: string;
  vendor_id?: number;
  cron?: string;
  update_time?: string;
};

export type JobServiceScheduleStatus = {
  paused?: boolean;
  load_error?: string;
};

export type HarborConfigurationItem = {
  value?: unknown;
  editable?: boolean;
};

export type HarborConfigurationValue =
  HarborConfigurationItem | boolean | number | string | null;

export type HarborConfiguration = Record<string, HarborConfigurationValue>;

export type RobotCredential = {
  id?: number;
  name: string;
  secret: string;
  creation_time?: string;
  expires_at?: number;
};

export type WebhookTarget = {
  type?: string;
  address?: string;
  auth_header?: string;
  skip_cert_verify?: boolean;
  payload_format?: string;
};

export type ProjectWebhook = {
  id: number;
  name: string;
  description?: string;
  project_id?: number;
  targets?: WebhookTarget[];
  event_types?: string[];
  enabled?: boolean;
  creation_time?: string;
  update_time?: string;
};

export type WebhookEventMetadata = {
  event_type?: string[];
  notify_type?: string[];
  payload_formats?: {
    notify_type?: string;
    formats?: string[];
  }[];
};

export type ExecutionMetrics = {
  task_count?: number;
  success_task_count?: number;
  error_task_count?: number;
  pending_task_count?: number;
  running_task_count?: number;
  scheduled_task_count?: number;
  stopped_task_count?: number;
};

export type WebhookExecution = {
  id: number;
  vendor_type?: string;
  vendor_id?: number;
  status?: string;
  status_message?: string;
  metrics?: ExecutionMetrics;
  trigger?: string;
  extra_attrs?: {
    event_type?: string;
    EventType?: string;
  };
  start_time?: string;
  end_time?: string;
};

export type WebhookTask = {
  id: number;
  execution_id?: number;
  status?: string;
  status_message?: string;
  run_count?: number;
  extra_attrs?: {
    event_type?: string;
    resource?: string;
    destination?: string;
  };
  creation_time?: string;
  update_time?: string;
  start_time?: string;
  end_time?: string;
};

export type HarborSelector = {
  kind: string;
  decoration: string;
  pattern: string;
  extras?: string;
};

export type ImmutableTagRule = {
  id: number;
  priority?: number;
  disabled?: boolean;
  action?: string;
  template?: string;
  params?: Record<string, unknown>;
  tag_selectors?: HarborSelector[];
  scope_selectors?: {
    repository?: HarborSelector[];
  };
};

export type RetentionSelectorMetadata = {
  kind?: string;
  decorations?: string[];
};

export type RetentionTemplateMetadata = {
  rule_template?: string;
  display_text?: string;
  action?: string;
  params?: {
    type?: string;
    unit?: string;
    required?: boolean;
  }[];
};

export type RetentionMetadata = {
  load_error?: string;
  templates?: RetentionTemplateMetadata[];
  scope_selectors?: RetentionSelectorMetadata[];
  tag_selectors?: RetentionSelectorMetadata[];
};

export type RetentionRule = {
  id?: number;
  priority?: number;
  disabled?: boolean;
  action?: string;
  template?: string;
  params?: Record<string, unknown>;
  tag_selectors?: HarborSelector[];
  scope_selectors?: {
    repository?: HarborSelector[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type RetentionPolicy = {
  id: number;
  algorithm?: string;
  rules?: RetentionRule[];
  trigger?: {
    kind?: string;
    settings?: {
      cron?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  scope?: {
    level?: string;
    ref?: number;
  };
  creation_time?: string;
  update_time?: string;
};

export type RetentionExecution = {
  id: number;
  policy_id?: number;
  status?: string;
  trigger?: string;
  dry_run?: boolean;
  start_time?: string;
  end_time?: string;
};

export type RetentionTask = {
  id: number;
  execution_id?: number;
  repository?: string;
  job_id?: string;
  status?: string;
  status_code?: number;
  status_revision?: number;
  start_time?: string;
  end_time?: string;
  total?: number;
  retained?: number;
};

export type AuditLog = {
  id: number;
  username?: string;
  resource?: string;
  resource_type?: string;
  operation?: string;
  operation_description?: string;
  operation_result?: boolean;
  op_time?: string;
};

export type AuditLogEvent = {
  event_type?: string;
};

export type PreheatProvider = {
  id: number;
  provider?: string;
  enabled?: boolean;
  default?: boolean;
};

export type PreheatProviderMetadata = {
  id: string;
  name?: string;
  version?: string;
  maintainers?: string[];
  source?: string;
};

export type PreheatInstance = {
  id: number;
  name: string;
  description?: string;
  vendor: string;
  endpoint: string;
  auth_mode?: string;
  auth_info?: Record<string, string>;
  status?: string;
  enabled?: boolean;
  default?: boolean;
  insecure?: boolean;
  setup_timestamp?: number;
};

export type PreheatFilter = {
  type?: string;
  value?: string;
  [key: string]: unknown;
};

export type PreheatTrigger = {
  type?: string;
  trigger_setting?: {
    cron?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type PreheatPolicy = {
  id: number;
  name: string;
  description?: string;
  project_id?: number;
  provider_id?: number;
  filters?: string | PreheatFilter[];
  trigger?: string | PreheatTrigger;
  enabled?: boolean;
  extra_attrs?: string | Record<string, unknown>;
  creation_time?: string;
  update_time?: string;
};

export type PreheatExecution = {
  id: number;
  vendor_type?: string;
  vendor_id?: number;
  status?: string;
  status_message?: string;
  metrics?: {
    task_count?: number;
    success_task_count?: number;
    error_task_count?: number;
    pending_task_count?: number;
    running_task_count?: number;
    scheduled_task_count?: number;
    stopped_task_count?: number;
  };
  trigger?: string;
  extra_attrs?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
};

export type PreheatTask = {
  id: number;
  execution_id?: number;
  status?: string;
  status_message?: string;
  run_count?: number;
  extra_attrs?: {
    artifact?: string;
    digest?: string;
    kind?: string;
    [key: string]: unknown;
  };
  creation_time?: string;
  update_time?: string;
  start_time?: string;
  end_time?: string;
};

export type ProjectLabel = {
  id: number;
  name: string;
  description?: string;
  color?: string;
  scope?: string;
  project_id?: number;
  creation_time?: string;
  update_time?: string;
};

export type PermissionMetadata = {
  project?: HarborPermission[];
  system?: HarborPermission[];
};

export type RepositorySummary = {
  id?: number;
  project_id?: number;
  name: string;
  description?: string;
  artifact_count?: number;
  pull_count?: number;
  creation_time?: string;
  update_time?: string;
};

export type ArtifactTag = {
  id?: number;
  repository_id?: number;
  artifact_id?: number;
  name: string;
  push_time?: string;
  pull_time?: string;
  signed?: boolean;
  immutable?: boolean;
};

export type ArtifactVulnerabilityCounts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type ArtifactScanOverview = {
  scan_status?: string;
  severity?: string;
  report_id?: string;
  scanner?: string;
  duration?: number;
  summary?: {
    total?: number;
    summary?: Partial<Record<"Critical" | "High" | "Low" | "Medium", number>> &
      Partial<Record<"critical" | "high" | "low" | "medium", number>>;
  };
};

export type ArtifactPlatform = {
  os?: string;
  architecture?: string;
  variant?: string;
  "os.version"?: string;
  os_version?: string;
  "os.features"?: string[];
  os_features?: string[];
  [key: string]: unknown;
};

export type ArtifactReference = {
  parent_id?: number;
  child_id?: number;
  child_digest?: string;
  platform?: ArtifactPlatform;
};

export type ArtifactAccessory = {
  id?: number;
  artifact_id?: number;
  subject_artifact_id?: number;
  subject_artifact_digest?: string;
  subject_artifact_repo?: string;
  size?: number;
  digest: string;
  type?: string;
  creation_time?: string;
};

export type HarborArtifact = {
  id?: number;
  project_id?: number;
  repository_id?: number;
  digest: string;
  type?: string;
  media_type?: string;
  manifest_media_type?: string;
  size?: number;
  icon?: string;
  push_time?: string;
  pull_time?: string;
  extra_attrs?: ArtifactPlatform;
  annotations?: Record<string, string>;
  tags?: ArtifactTag[];
  labels?: ProjectLabel[];
  scan_overview?: Record<string, ArtifactScanOverview>;
  sbom_overview?: Record<string, ArtifactScanOverview>;
  accessories?: ArtifactAccessory[];
  references?: ArtifactReference[];
};

export type ArtifactVulnerability = {
  id?: string;
  cve_id?: string;
  severity?: string;
  package?: string;
  package_name?: string;
  version?: string;
  package_version?: string;
  fix_version?: string;
  fixed_version?: string;
  description?: string;
};

export type ArtifactVulnerabilityReport = {
  scanner?: { name?: string; version?: string };
  severity?: string;
  vulnerabilities?: ArtifactVulnerability[];
  generated_at?: string;
  [key: string]: unknown;
};

export type ArtifactLabelCollection = {
  attached: ProjectLabel[];
  available: ProjectLabel[];
  load_error?: string;
};

export type DashboardStatistics = {
  total_project_count?: number;
  public_project_count?: number;
  private_project_count?: number;
  total_repo_count?: number;
  public_repo_count?: number;
  private_repo_count?: number;
  total_artifact_count?: number;
  total_storage_consumption?: number;
};

export type ReplicationRegistry = {
  id?: number;
  name?: string;
};

export type ReplicationTrigger = {
  type?: string;
  trigger_settings?: {
    cron?: string;
    [key: string]: unknown;
  };
};

export type ReplicationFilter = {
  type?: "label" | "name" | "resource" | "tag";
  value?: string | string[];
  decoration?: "excludes" | "matches";
};

export type ReplicationPolicy = {
  id?: number;
  name?: string;
  description?: string;
  enabled?: boolean;
  src_registry?: ReplicationRegistry;
  dest_registry?: ReplicationRegistry;
  trigger?: ReplicationTrigger;
  filters?: ReplicationFilter[];
  dest_namespace?: string;
  dest_namespace_replace_count?: -1 | 0 | 1 | 2 | 3;
  override?: boolean;
  speed?: number;
  single_active_replication?: boolean;
  replicate_deletion?: boolean;
  copy_by_chunk?: boolean;
  creation_time?: string;
  update_time?: string;
};

export type ReplicationExecution = {
  id?: number;
  policy_id?: number;
  trigger?: string;
  status?: string;
  succeed?: number;
  failed?: number;
  in_progress?: number;
  stopped?: number;
  total?: number;
  start_time?: string;
  end_time?: string;
};

export type ReplicationTask = {
  id: number;
  execution_id?: number;
  resource_type?: string;
  src_resource?: string;
  dst_resource?: string;
  operation?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
};

export type Dashboard = {
  mode?: "demo" | "live";
  health?: HarborHealth;
  systeminfo?: HarborSystemInfo;
  statistics?: DashboardStatistics;
  projects?: ProjectSummary[];
  replications?: ReplicationExecution[];
  replication_policies?: ReplicationPolicy[];
  warnings?: string[];
};

export type HarborIdentity = {
  user_id?: number;
  username?: string;
  email?: string;
  realname?: string;
  comment?: string;
  sysadmin_flag?: boolean;
  admin_role_in_auth?: boolean;
  oidc_user_meta?: unknown;
};

export type HarborPermission = {
  resource?: string;
  action?: string;
};

export type ControlDataResponse<T> = {
  data?: T;
};

export type ControlListResponse<T> = {
  items?: T[];
  pagination?: {
    page?: number;
    page_size?: number;
    total?: number;
  };
};

export type ControlPagination = {
  page: number;
  page_size: number;
  total: number;
};

export type ControlList<T> = {
  items: T[];
  pagination: ControlPagination;
};
