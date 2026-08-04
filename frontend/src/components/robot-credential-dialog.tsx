import type { RobotCredential } from "../app/models";
import { useLocale } from "../app/locale-context";
import { ControlDialog } from "./control-dialog";
import { Icon } from "./icons";

export function RobotCredentialDialog({
  credential,
  onClose,
  onCopied,
}: {
  credential: RobotCredential;
  onClose: () => void;
  onCopied: (error?: boolean) => void;
}) {
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
      onSubmit={() => Promise.resolve(onClose())}
    >
      <div className="credential-result">
        {[
          { label: "用户名", value: credential.name, action: "复制用户名" },
          { label: "密钥", value: credential.secret, action: "复制密钥" },
        ].map((item) => (
          <div key={item.label}>
            <span>{t(item.label)}</span>
            <code>{item.value}</code>
            <button
              className="icon-button"
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
