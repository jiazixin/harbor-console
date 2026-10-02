import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { request } from "../../app/api-client";
import { formatBytes, formatDate, formatNumber } from "../../app/formatters";
import { useLocale } from "../../app/locale-context";
import type { Dashboard, Session, SystemVolumes } from "../../app/models";
import { DefinitionList } from "../../components/definition-list";
import { Icon } from "../../components/icons";
import {
  DemoBanner,
  PageHeader,
  RefreshButton,
} from "../../components/page-elements";
import { StatusBadge } from "../../components/status-badge";

function authModeLabel(value: string | undefined): string {
  return (
    {
      db_auth: "数据库认证",
      ldap_auth: "LDAP 认证",
      oidc_auth: "OIDC 认证",
      uaa_auth: "UAA 认证",
    }[value ?? ""] ??
    value ??
    "未知"
  );
}

function componentLabel(value: string | undefined): string {
  return (
    {
      core: "核心服务",
      database: "数据库",
      jobservice: "任务服务",
      registry: "镜像注册服务",
      redis: "Redis 缓存",
      portal: "门户服务",
      registryctl: "注册控制器",
    }[value?.toLowerCase() ?? ""] ??
    value ??
    "未知组件"
  );
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div className="panel-head">
      <div>
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </div>
      {action}
    </div>
  );
}

export function SystemPage({
  session,
  dashboard,
  refreshing,
  onRefresh,
}: {
  session: Session;
  dashboard: Dashboard;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { locale, t } = useLocale();
  const [volumes, setVolumes] = useState<SystemVolumes>();
  const [volumeError, setVolumeError] = useState("");
  const [version, setVersion] = useState(0);
  const requestVersion = useRef(0);
  const reload = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const current = requestVersion.current + 1;
    requestVersion.current = current;
    setVolumes(undefined);
    setVolumeError("");
    void request<SystemVolumes>("/api/resources/volumes", {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted && requestVersion.current === current)
          setVolumes(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestVersion.current !== current)
          return;
        setVolumeError(error instanceof Error ? error.message : String(error));
        setVolumes({});
      });
    return () => controller.abort();
  }, [version]);

  const system = dashboard.systeminfo ?? {};
  const health = dashboard.health ?? {};
  const components = health.components ?? [];
  const storage = volumes?.storage ?? [];
  const total = storage.reduce(
    (sum, item) => sum + Math.max(0, item.total ?? 0),
    0,
  );
  const free = storage.reduce(
    (sum, item) => sum + Math.max(0, item.free ?? 0),
    0,
  );
  const used = Math.max(0, total - free);
  const percent = total ? Math.min(100, (used / total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="系统状态"
        subtitle={t("查看 Harbor 配置、组件和存储状态")}
        actions={
          <RefreshButton
            refreshing={refreshing || volumes === undefined}
            onRefresh={() => {
              reload();
              onRefresh();
            }}
          />
        }
      />
      {session.demo ? <DemoBanner /> : null}
      {(dashboard.warnings ?? []).map((warning) => (
        <div className="warning-banner" key={warning}>
          <Icon name="alert" />
          <span>{warning}</span>
        </div>
      ))}
      <div className="system-grid">
        <section className="panel">
          <PanelHeader
            title="实例信息"
            subtitle="Harbor 运行配置"
            action={<StatusBadge status={health.status} />}
          />
          <DefinitionList
            rows={[
              {
                label: t("Harbor 版本"),
                value: system.harbor_version ?? t("未知"),
              },
              {
                label: t("认证方式"),
                value: t(authModeLabel(system.auth_mode)),
              },
              {
                label: t("镜像域名"),
                value: system.registry_url ?? session.instance_url,
              },
              {
                label: t("项目创建"),
                value: t(
                  system.project_creation_restriction === "adminonly"
                    ? "仅管理员"
                    : "所有用户",
                ),
              },
              {
                label: t("自助注册"),
                value: t(system.self_registration ? "已启用" : "未启用"),
              },
              {
                label: t("只读模式"),
                value: t(system.read_only ? "已启用" : "未启用"),
              },
            ]}
          />
        </section>
        <section className="panel">
          <PanelHeader
            title="核心组件"
            subtitle={
              locale === "en-US"
                ? `${formatNumber(components.length, locale)} services`
                : `${formatNumber(components.length, locale)} 个服务`
            }
          />
          <div className="component-list">
            {components.length ? (
              components.map((component, index) => (
                <div
                  className="component-row"
                  key={`${component.name ?? "component"}-${String(index)}`}
                >
                  <span>{t(componentLabel(component.name))}</span>
                  <StatusBadge status={component.status} />
                </div>
              ))
            ) : (
              <div className="empty-inline">
                {t("当前账号无法读取组件详情")}
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <PanelHeader title="存储容量" subtitle="制品存储后端" />
          {volumeError ? (
            <div className="warning-banner warning-banner-inset">
              <Icon name="alert" />
              <span>{volumeError}</span>
            </div>
          ) : total > 0 ? (
            <div className="volume-meter">
              <div className="volume-value">
                <strong>{formatBytes(used, locale)}</strong>
                <span>
                  {t("总容量")} {formatBytes(total, locale)}
                </span>
              </div>
              <progress
                className="volume-track"
                max={100}
                value={percent}
                aria-label={`${t("存储空间已使用")} ${percent.toFixed(1)}%`}
              />
              <p className="muted">
                {locale === "en-US"
                  ? `${percent.toFixed(1)}% used, ${formatBytes(free, locale)} remaining`
                  : `已使用 ${percent.toFixed(1)}%，剩余 ${formatBytes(free, locale)}`}
              </p>
            </div>
          ) : volumes ? (
            <div className="warning-banner warning-banner-inset">
              <Icon name="alert" />
              <span>
                {t(
                  "Harbor 未返回本地存储容量；使用外部对象存储时属于正常情况。",
                )}
              </span>
            </div>
          ) : (
            <div
              className="route-loading"
              role="status"
              aria-label={t("正在载入")}
            >
              <span className="spinner spinner-small" />
            </div>
          )}
        </section>
        <section className="panel">
          <PanelHeader title="连接会话" subtitle="控制台本地会话信息" />
          <DefinitionList
            rows={[
              { label: t("当前用户"), value: session.username },
              {
                label: t("实例地址"),
                value: session.instance_url,
                title: session.instance_url,
              },
              {
                label: t("连接类型"),
                value: t(session.demo ? "演示会话" : "真实实例"),
              },
              {
                label: t("会话到期"),
                value: formatDate(session.expires_at, locale),
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}
