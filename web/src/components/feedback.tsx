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

// The Go server reports every Harbor 403 with this message (see
// friendlyUpstreamError); the English form is its translation.
const permissionDeniedMessages = [
  "当前 Harbor 账号没有访问该资源的权限",
  "This Harbor account cannot access the resource",
];

function isPermissionDenied(message: string): boolean {
  return permissionDeniedMessages.some((text) => message.includes(text));
}

/**
 * Failure state for a page, section or dialog. Permission errors get their own
 * explanation and no retry button, because retrying cannot succeed.
 */
export function ErrorView({
  message,
  retry,
  retryLabel = "重试",
  title = "内容载入失败",
}: {
  message: string;
  retry?: () => void;
  retryLabel?: string;
  title?: string;
}) {
  const { t } = useLocale();
  const permissionDenied = isPermissionDenied(message);
  return (
    <div className="error-state" role="alert">
      <div>
        <span className="state-icon">
          <Icon name={permissionDenied ? "shield" : "alert"} />
        </span>
        <h2>{t(permissionDenied ? "没有访问权限" : title)}</h2>
        <p>
          {permissionDenied
            ? t(
                "当前 Harbor 账号没有访问此内容所需的权限。如需访问，请联系 Harbor 系统管理员。",
              )
            : t(message)}
        </p>
        {retry && !permissionDenied ? (
          <button className="button button-small" type="button" onClick={retry}>
            <Icon name="refresh" />
            <span>{t(retryLabel)}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
