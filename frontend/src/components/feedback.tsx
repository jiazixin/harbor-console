import { useLocale } from "../app/locale-context";
import { Icon } from "./icons";

export function LoadingView() {
  const { t } = useLocale();
  return (
    <div className="loading-state" role="status">
      <div>
        <span className="spinner" aria-hidden="true" />
        <h2>{t("正在读取 Harbor 实例")}</h2>
        <p>{t("正在聚合项目、复制任务与系统状态...")}</p>
      </div>
    </div>
  );
}

export function ErrorView({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="error-state" role="alert">
      <div>
        <span className="state-icon">
          <Icon name="alert" />
        </span>
        <h2>{t("无法载入实例概览")}</h2>
        <p>{message}</p>
        <button className="button button-small" type="button" onClick={retry}>
          <Icon name="refresh" />
          <span>{t("重试")}</span>
        </button>
      </div>
    </div>
  );
}
