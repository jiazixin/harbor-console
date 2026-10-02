import { useLocale } from "../app/locale-context";
import { Icon } from "./icons";

export function LoadingView({
  title = "正在读取 Harbor 实例",
  description = "正在聚合项目、复制任务与系统状态...",
}: { title?: string; description?: string } = {}) {
  const { t } = useLocale();
  return (
    <div className="loading-state" role="status">
      <div>
        <span className="spinner" aria-hidden="true" />
        <h2>{t(title)}</h2>
        <p>{t(description)}</p>
      </div>
    </div>
  );
}

export function ErrorView({
  message,
  retry,
  title = "无法载入实例概览",
}: {
  message: string;
  retry: () => void;
  title?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="error-state" role="alert">
      <div>
        <span className="state-icon">
          <Icon name="alert" />
        </span>
        <h2>{t(title)}</h2>
        <p>{message}</p>
        <button className="button button-small" type="button" onClick={retry}>
          <Icon name="refresh" />
          <span>{t("重试")}</span>
        </button>
      </div>
    </div>
  );
}
