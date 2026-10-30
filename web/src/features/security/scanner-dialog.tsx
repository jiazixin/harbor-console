import { useState } from "react";
import { useLocale } from "../../app/locale-context";
import type { ScannerRegistration } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { FormInput } from "../../components/form-input";
import { FormTextarea } from "../../components/form-textarea";
import uiStyles0 from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries, formString } from "./security-dialogs-support";

type ScannerDialogProps = {
  scanner?: ScannerRegistration;
  canDisable?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function ScannerDialog({
  scanner,
  canDisable = true,
  onClose,
  onSaved,
}: ScannerDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const { t } = useLocale();
  const [auth, setAuth] = useState(scanner?.auth ?? "");
  const disableUnavailable = scanner?.is_default === true || !canDisable;
  return (
    <ControlDialog
      title={scanner ? "编辑扫描器" : "注册扫描器"}
      subtitle="兼容 Harbor Scanner Adapter API"
      submitLabel={scanner ? "保存扫描器" : "注册扫描器"}
      onClose={onClose}
      onSubmit={async (formData) => {
        await mutate({
          operation: scanner ? "scanner" : "scanners",
          parameters: scanner ? { id: scanner.uuid } : {},
          method: scanner ? "PUT" : "POST",
          payload: {
            name: formString(formData, "name"),
            description: formString(formData, "description"),
            url: formString(formData, "url"),
            auth: formString(formData, "auth"),
            access_credential: formString(formData, "access_credential"),
            disabled: disableUnavailable ? false : formData.has("disabled"),
            skip_certVerify: formData.has("skip_cert_verify"),
            use_internal_addr: formData.has("use_internal_addr"),
          },
        });
        onSaved();
      }}
    >
      <div className={resolveClasses("form-grid two-columns")}>
        <label className={resolveClasses("field")}>
          <span>{t("名称")}</span>
          <FormInput
            name="name"
            required
            maxLength={128}
            defaultValue={scanner?.name}
          />
        </label>
        <label className={resolveClasses("field")}>
          <span>{t("认证方式")}</span>
          <UnifiedSelect
            name="auth"
            ariaLabel={t("认证方式")}
            value={auth}
            options={[
              { value: "", label: t("无认证") },
              { value: "Basic", label: "Basic" },
              { value: "Bearer", label: "Bearer" },
              { value: "X-ScannerAdapter-API-Key", label: "API Key" },
            ]}
            onChange={setAuth}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("适配器地址")}</span>
          <FormInput
            name="url"
            type="url"
            required
            maxLength={512}
            defaultValue={scanner?.url}
            placeholder="http://scanner-adapter:8080"
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("访问凭据")}</span>
          <FormInput
            name="access_credential"
            type="password"
            maxLength={512}
            autoComplete="new-password"
            placeholder={t(
              scanner ? "留空保留原凭据" : "认证方式为无认证时可留空",
            )}
          />
        </label>
        <label className={resolveClasses("field field-span")}>
          <span>{t("描述")}</span>
          <FormTextarea
            name="description"
            rows={3}
            maxLength={1024}
            defaultValue={scanner?.description}
          />
        </label>
      </div>
      <div className={resolveClasses("check-grid")}>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="disabled"
            type="checkbox"
            defaultChecked={disableUnavailable ? false : scanner?.disabled}
            disabled={disableUnavailable}
          />
          <span>
            <strong>{t("停用扫描器")}</strong>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="skip_cert_verify"
            type="checkbox"
            defaultChecked={scanner?.skip_certVerify}
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
          </span>
        </label>
        <label className={resolveClasses("check-row")}>
          <FormInput
            name="use_internal_addr"
            type="checkbox"
            defaultChecked={scanner?.use_internal_addr}
          />
          <span>
            <strong>{t("使用内部仓库地址")}</strong>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

const resolveClasses = createClassNames({
  "control-dialog": uiStyles0.controlDialog,
  "unified-select": uiStyles0.unifiedSelect,
  "form-grid": uiStyles0.formGrid,
  "two-columns": uiStyles0.twoColumns,
  field: uiStyles0.field,
  "field-span": uiStyles0.fieldSpan,
  "check-grid": uiStyles0.checkGrid,
  "check-row": uiStyles0.checkRow,
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
});
