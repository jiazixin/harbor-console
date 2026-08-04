import { Fragment, type ReactNode } from "react";

import { useLocale } from "../app/locale-context";
import { Icon, type IconName } from "./icons";

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
  motionClass = "",
}: {
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  motionClass?: string;
}) {
  const { t } = useLocale();
  const translatedTitle = t(title);
  return (
    <header className={`page-header${motionClass}`}>
      <div>
        {breadcrumb}
        <h1 title={translatedTitle}>{translatedTitle}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  const { t } = useLocale();
  return (
    <nav className="breadcrumb" aria-label={t("面包屑")}>
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${String(index)}`}>
          {index > 0 ? <Icon name="chevron" /> : null}
          {item.href ? (
            <a href={item.href}>{t(item.label)}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function RefreshButton({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      className="button button-small"
      type="button"
      disabled={refreshing}
      onClick={onRefresh}
    >
      <Icon name="refresh" />
      <span>{t("刷新")}</span>
    </button>
  );
}

export function DemoBanner({ motionClass = "" }: { motionClass?: string }) {
  const { t } = useLocale();
  return (
    <div className={`demo-banner${motionClass}`}>
      <Icon name="alert" />
      <span>
        <strong>{t("当前为演示模式。")}</strong>{" "}
        {t("页面中的资产与状态为内置样例，连接真实实例后会自动替换。")}
      </span>
    </div>
  );
}

export function StatCell({
  label,
  value,
  foot,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  foot: ReactNode;
  icon: IconName;
}) {
  return (
    <div className="stat-cell">
      <span className="stat-label">
        <span>{label}</span>
        <Icon name={icon} />
      </span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-foot">{foot}</span>
    </div>
  );
}
