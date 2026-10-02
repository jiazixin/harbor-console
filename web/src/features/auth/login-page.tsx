import { type FormEvent, useRef, useState } from "react";

import { ApiError, sessionApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { Session } from "../../app/models";
import { HarborBrand } from "../../components/harbor-brand";
import { Icon } from "../../components/icons";
import { LanguageSwitch } from "../../components/language-switch";
import { UnifiedSelect } from "../../components/unified-select";
import {
  createPublicCatalogState,
  openPublicCatalogHistory,
  PublicCatalogView,
  restorePublicCatalogState,
} from "./public-catalog-view";
import type { PublicCatalogState } from "../../app/models";

type Protocol = "https" | "http";

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
}

function normalizedAddress(address: string, protocol: Protocol): string {
  const value = address.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${protocol}://${value.replace(/^\/+/, "")}`;
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

export function LoginPage({
  onAuthenticated,
  onNotice,
}: {
  onAuthenticated: (session: Session) => void;
  onNotice: (message: string, error?: boolean) => void;
}) {
  const { t } = useLocale();
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = formString(data, "username").trim();
    const password = formString(data, "password");
    const url = normalizedAddress(address, protocol);
    if (!url || !username || !password) {
      setError(t("请完整填写 Harbor 地址、用户名和密码。"));
      return;
    }
    setBusy("connect");
    setError("");
    try {
      onAuthenticated(
        await sessionApi.connect({
          url,
          username,
          password,
          skip_tls_verify: skipTlsVerify,
        }),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setBusy(null);
    }
  }

  async function enterDemo() {
    setBusy("demo");
    setError("");
    try {
      onAuthenticated(await sessionApi.demo());
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setBusy(null);
    }
  }

  function updateAddress(value: string) {
    const match = /^(https?):\/\/(.*)$/i.exec(value.trimStart());
    if (match) {
      setProtocol(match[1].toLowerCase() as Protocol);
      setAddress(match[2]);
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
    <div id="login-view" className="connect-view">
      <header className="connect-header">
        <HarborBrand href="#" />
        <div className="connect-header-actions">
          <span className="product-note">{t("统一镜像资产与供应链安全")}</span>
          <LanguageSwitch />
        </div>
      </header>

      <main className="connect-main">
        <section className="connect-copy" aria-labelledby="connect-title">
          <span className="eyebrow">{t("容器镜像控制面板")}</span>
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
          <dl className="connection-facts">
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

        <section className="connect-panel" aria-label={t("连接 Harbor")}>
          <div className="panel-heading">
            <div>
              <span className="section-index">01</span>
              <h2>{t("实例登录")}</h2>
            </div>
            <span className="secure-label">
              <Icon name="shield" />
              {t("服务端连接")}
            </span>
          </div>
          <form
            id="connect-form"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <label htmlFor="instance-address">{t("Harbor 地址")}</label>
            <div className="url-input-group connect-url-group">
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
              <input
                ref={addressInputRef}
                id="instance-address"
                name="address"
                type="text"
                inputMode="url"
                placeholder="harbor.example.com"
                autoComplete="url"
                value={address}
                onChange={(event) => updateAddress(event.target.value)}
                required
              />
            </div>
            <div className="field-grid">
              <div>
                <label htmlFor="username">{t("用户名")}</label>
                <input
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
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={t("输入密码")}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <label className="check-row" htmlFor="skip-tls">
              <input
                id="skip-tls"
                name="skip_tls_verify"
                type="checkbox"
                checked={skipTlsVerify}
                onChange={(event) =>
                  setSkipTlsVerify(event.currentTarget.checked)
                }
              />
              <span>
                <b>{t("允许自签名证书")}</b>
                <small>{t("仅在内网测试环境中启用")}</small>
              </span>
            </label>
            {error ? (
              <div id="connect-error" className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <button
              id="connect-submit"
              className="button button-primary button-wide"
              type="submit"
              disabled={busy !== null}
            >
              <span>
                {busy === "connect" ? t("正在验证连接...") : t("连接实例")}
              </span>
              {busy === "connect" ? (
                <span className="spinner spinner-small" />
              ) : (
                <Icon name="arrow-right" />
              )}
            </button>
          </form>
          <div className="demo-row">
            <span>{t("还没有可用实例？")}</span>
            <button
              id="demo-button"
              className="text-button"
              type="button"
              disabled={busy !== null}
              onClick={() => void enterDemo()}
            >
              {busy === "demo" ? t("正在准备演示...") : t("使用演示数据预览")}
            </button>
          </div>
          <button
            id="public-catalog-button"
            className="public-catalog-entry"
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
      <footer className="connect-footer">
        <span>Harbor API v2</span>
        <span>{t("凭据不写入磁盘")}</span>
        <span>{t("适配桌面与移动设备")}</span>
      </footer>
    </div>
  );
}
