import { type SubmitEvent, useRef, useState } from "react";
import { errorText } from "../../app/errors";
import { useLocale } from "../../app/locale-context";
import type { PublicCatalogState, Session } from "../../app/models";
import { formErrors, FormErrorsContext } from "../../components/form-errors";
import { FormInput } from "../../components/form-input";
import { HarborBrand } from "../../components/harbor-brand";
import { Icon } from "../../components/icon";
import { LanguageSwitch } from "../../components/language-switch";
import {
  default as sharedPrimitiveStyles,
  default as uiStyles0,
} from "../../components/shared-ui.module.css";
import { UnifiedSelect } from "../../components/unified-select";
import { createClassNames } from "../../lib/css/class-names";
import styles from "./auth.module.css";
import {
  createPublicCatalogState,
  openPublicCatalogHistory,
  PublicCatalogView,
  restorePublicCatalogState,
} from "./public-catalog-view";
import { useAuthentication } from "./use-authentication";

type Protocol = "https" | "http";

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function normalizedAddress(address: string, protocol: Protocol): string {
  const value = address.trim();
  if (!value) return "";
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `${protocol}://${value}`,
    );
    if (
      !url.hostname ||
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname && url.pathname !== "/")
    )
      return "";
    return url.origin;
  } catch {
    // Invalid addresses never enter the public-catalog history or browser storage.
    return "";
  }
}

function addressParts(url: string | undefined): {
  protocol: Protocol;
  address: string;
} {
  try {
    const parsed = new URL(url ?? "");
    return {
      protocol: parsed.protocol === "http:" ? "http" : "https",
      address: `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`,
    };
  } catch {
    return { protocol: "https", address: "" };
  }
}

type LoginPageProps = {
  onAuthenticated: (session: Session) => void;
  onNotice: (message: string, error?: boolean) => void;
};

export function LoginPage({ onAuthenticated, onNotice }: LoginPageProps) {
  const { t } = useLocale();
  const authentication = useAuthentication();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [initialCatalog] = useState(restorePublicCatalogState);
  const initialAddress = addressParts(initialCatalog?.url);
  const [catalog, setCatalog] = useState<PublicCatalogState | undefined>(
    initialCatalog,
  );
  const [protocol, setProtocol] = useState<Protocol>(initialAddress.protocol);
  const [address, setAddress] = useState(initialAddress.address);
  const [skipTlsVerify, setSkipTlsVerify] = useState(
    initialCatalog?.skip_tls_verify ?? false,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"connect" | "demo" | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = formString(form, "username").trim();
    const password = formString(form, "password");
    const url = normalizedAddress(address, protocol);
    if (!url || !username || !password) {
      setError(t("请完整填写 Harbor 地址、用户名和密码。"));
      return;
    }
    setBusy("connect");
    setError("");
    setFields({});
    try {
      onAuthenticated(
        await authentication.mutateAsync({
          url,
          username,
          password,
          skip_tls_verify: skipTlsVerify,
        }),
      );
    } catch (requestError) {
      setFields(formErrors(requestError));
      setError(errorText(requestError));
    } finally {
      setBusy(null);
    }
  }

  async function enterDemo() {
    setBusy("demo");
    setError("");
    setFields({});
    try {
      onAuthenticated(await authentication.mutateAsync(undefined));
    } catch (requestError) {
      setFields(formErrors(requestError));
      setError(errorText(requestError));
    } finally {
      setBusy(null);
    }
  }

  function updateAddress(value: string) {
    const match = /^(https?):\/\/(.*)$/i.exec(value.trimStart());
    if (match) {
      const [, protocol = "", address = ""] = match;
      setProtocol(protocol.toLowerCase() === "http" ? "http" : "https");
      setAddress(address);
      return;
    }
    setAddress(value);
  }

  function openPublicCatalog() {
    const url = normalizedAddress(address, protocol);
    if (!url) {
      setError(t("请先填写需要浏览的 Harbor 地址。"));
      return;
    }
    const next = createPublicCatalogState(url, skipTlsVerify);
    setError("");
    setFields({});
    openPublicCatalogHistory(next);
    setCatalog(next);
  }

  function closePublicCatalog(current: PublicCatalogState) {
    const parts = addressParts(current.url);
    setProtocol(parts.protocol);
    setAddress(parts.address);
    setSkipTlsVerify(current.skip_tls_verify);
    setCatalog(undefined);
    window.setTimeout(() => addressInputRef.current?.focus(), 20);
  }

  if (catalog) {
    return (
      <PublicCatalogView
        initialCatalog={catalog}
        onClose={closePublicCatalog}
        onNotice={onNotice}
      />
    );
  }

  return (
    <div id="login-view" className={resolveClasses("connect-view")}>
      <header className={resolveClasses(styles.connectHeader)}>
        <HarborBrand href="#" />
        <div className={resolveClasses(styles.connectHeaderActions)}>
          <span className={resolveClasses(styles.productNote)}>
            {t("统一镜像资产与供应链安全")}
          </span>
          <LanguageSwitch />
        </div>
      </header>

      <main className={resolveClasses(styles.connectMain)}>
        <section
          className={resolveClasses(styles.connectCopy)}
          aria-labelledby="connect-title"
        >
          <span className={resolveClasses("eyebrow")}>
            {t("容器镜像控制面板")}
          </span>
          <h1 id="connect-title" aria-label={t("连接你的 Harbor 实例")}>
            {t("连接你的")}
            <br />
            <span>{t("Harbor 实例")}</span>
          </h1>
          <p>
            {t(
              "集中查看项目、仓库、漏洞扫描与复制任务。连接信息仅保存在当前服务进程的临时会话中。",
            )}
          </p>
          <dl className={resolveClasses(styles.connectionFacts)}>
            <div>
              <dt>API</dt>
              <dd>Harbor v2</dd>
            </div>
            <div>
              <dt>{t("会话")}</dt>
              <dd>{t("12 小时")}</dd>
            </div>
            <div>
              <dt>{t("存储")}</dt>
              <dd>{t("不落盘")}</dd>
            </div>
          </dl>
        </section>

        <section
          className={resolveClasses(styles.connectPanel)}
          aria-label={t("连接 Harbor")}
        >
          <div className={resolveClasses(styles.panelHeading)}>
            <div>
              <span className={resolveClasses(styles.sectionIndex)}>01</span>
              <h2>{t("实例登录")}</h2>
            </div>
            <span className={resolveClasses(styles.secureLabel)}>
              <Icon name="shield" />
              {t("服务端连接")}
            </span>
          </div>
          <FormErrorsContext value={fields}>
            <form
              id="connect-form"
              noValidate
              onSubmit={(event) => void submit(event)}
            >
              <label htmlFor="instance-address">{t("Harbor 地址")}</label>
              <div
                className={resolveClasses(
                  `url-input-group ${styles.connectUrlGroup}`,
                )}
              >
                <UnifiedSelect
                  ariaLabel={t("连接协议")}
                  name="protocol"
                  options={[
                    { value: "https", label: "https://" },
                    { value: "http", label: "http://" },
                  ]}
                  value={protocol}
                  onChange={setProtocol}
                />
                <FormInput
                  ref={addressInputRef}
                  id="instance-address"
                  name="address"
                  type="text"
                  inputMode="url"
                  placeholder="harbor.example.com"
                  autoComplete="url"
                  value={address}
                  onChange={(event) => {
                    updateAddress(event.target.value);
                  }}
                  required
                />
              </div>
              <div className={resolveClasses(styles.fieldGrid)}>
                <div>
                  <label htmlFor="username">{t("用户名")}</label>
                  <FormInput
                    id="username"
                    name="username"
                    type="text"
                    placeholder="admin"
                    autoComplete="username"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password">{t("密码")}</label>
                  <FormInput
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t("输入密码")}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
              <label className={resolveClasses("check-row")} htmlFor="skip-tls">
                <FormInput
                  id="skip-tls"
                  name="skip_tls_verify"
                  type="checkbox"
                  checked={skipTlsVerify}
                  onChange={(event) => {
                    setSkipTlsVerify(event.currentTarget.checked);
                  }}
                />
                <span>
                  <b>{t("允许自签名证书")}</b>
                  <small>{t("仅在内网测试环境中启用")}</small>
                </span>
              </label>
              {error ? (
                <div
                  id="connect-error"
                  className={resolveClasses(styles.formError)}
                  role="alert"
                >
                  {error}
                </div>
              ) : null}
              <button
                id="connect-submit"
                className={resolveClasses("button button-primary button-wide")}
                type="submit"
                disabled={busy !== null}
              >
                <span>
                  {busy === "connect" ? t("正在验证连接...") : t("连接实例")}
                </span>
                {busy === "connect" ? (
                  <span className={resolveClasses("spinner button-spinner")} />
                ) : (
                  <Icon name="arrow-right" />
                )}
              </button>
            </form>
          </FormErrorsContext>
          <div className={resolveClasses(styles.demoRow)}>
            <span>{t("还没有可用实例？")}</span>
            <button
              id="demo-button"
              className={resolveClasses(styles.textButton)}
              type="button"
              disabled={busy !== null}
              onClick={() => void enterDemo()}
            >
              {busy === "demo" ? t("正在准备演示...") : t("使用演示数据预览")}
            </button>
          </div>
          <button
            id="public-catalog-button"
            className={resolveClasses(styles.publicCatalogEntry)}
            type="button"
            disabled={busy !== null}
            onClick={openPublicCatalog}
          >
            <Icon name="package" />
            <span>
              <b>{t("浏览公开镜像目录")}</b>
              <small>{t("无需登录，仅显示公开项目与制品")}</small>
            </span>
            <Icon name="arrow-right" />
          </button>
        </section>
      </main>
      <footer className={resolveClasses(styles.connectFooter)}>
        <span>Harbor API v2</span>
        <span>{t("凭据不写入磁盘")}</span>
        <span>{t("适配桌面与移动设备")}</span>
      </footer>
    </div>
  );
}

const resolveClasses = createClassNames({
  "connect-view": sharedPrimitiveStyles.connectView,
  icon: uiStyles0.icon,
  "language-switch": uiStyles0.languageSwitch,
  "unified-select": uiStyles0.unifiedSelect,
  eyebrow: uiStyles0.eyebrow,
  "url-input-group": uiStyles0.urlInputGroup,
  "check-row": uiStyles0.checkRow,
  button: uiStyles0.button,
  "button-primary": uiStyles0.buttonPrimary,
  "button-wide": uiStyles0.buttonWide,
  spinner: uiStyles0.spinner,
  "button-spinner": uiStyles0.buttonSpinner,
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
