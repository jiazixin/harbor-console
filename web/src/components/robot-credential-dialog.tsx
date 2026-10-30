import { useLocale } from "../app/locale-context";
import type { RobotCredential } from "../app/models";
import { createClassNames } from "../lib/css/class-names";
import { ControlDialog } from "./control-dialog";
import { Icon } from "./icon";
import uiStyles1 from "./robot-credential-dialog.module.css";
import uiStyles0 from "./shared-ui.module.css";

type RobotCredentialDialogProps = {
  credential: RobotCredential;
  onClose: () => void;
  onCopied: (error?: boolean) => void;
};

export function RobotCredentialDialog({
  credential,
  onClose,
  onCopied,
}: RobotCredentialDialogProps) {
  const { t } = useLocale();

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      onCopied();
    } catch {
      onCopied(true);
    }
  }

  return (
    <ControlDialog
      title="机器人凭据"
      subtitle="密钥关闭后无法再次查看"
      submitLabel="完成"
      showCancel={false}
      onClose={onClose}
      onSubmit={onClose}
    >
      <div className={resolveClasses("credential-result")}>
        {[
          { label: "用户名", value: credential.name, action: "复制用户名" },
          { label: "密钥", value: credential.secret, action: "复制密钥" },
        ].map((item) => (
          <div key={item.label}>
            <span>{t(item.label)}</span>
            <code>{item.value}</code>
            <button
              className={resolveClasses("icon-button")}
              type="button"
              aria-label={t(item.action)}
              title={t(item.action)}
              onClick={() => void copy(item.value)}
            >
              <Icon name="copy" />
            </button>
          </div>
        ))}
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  icon: uiStyles0.icon,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  "harbor-banner-warning": uiStyles0.harborBannerWarning,
  "harbor-banner-success": uiStyles0.harborBannerSuccess,
  "harbor-banner-info": uiStyles0.harborBannerInfo,
  "harbor-banner-danger": uiStyles0.harborBannerDanger,
  clickable: uiStyles0.clickable,
  "overlay-open": uiStyles0.overlayOpen,
  "log-level-trace": uiStyles0.logLevelTrace,
  "log-level-debug": uiStyles0.logLevelDebug,
  "log-level-log": uiStyles0.logLevelLog,
  "log-level-info": uiStyles0.logLevelInfo,
  "log-level-warn": uiStyles0.logLevelWarn,
  "log-level-error": uiStyles0.logLevelError,
  "log-level-fatal": uiStyles0.logLevelFatal,
  "credential-result": uiStyles1.credentialResult,
});
