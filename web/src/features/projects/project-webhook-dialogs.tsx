import { useState } from "react";

import { controlApi } from "../../app/api-client";
import { useLocale } from "../../app/locale-context";
import type { ProjectWebhook, WebhookEventMetadata } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import { Icon } from "../../components/icons";
import { UnifiedSelect } from "../../components/unified-select";

const fallbackEvents = [
  "PUSH_ARTIFACT",
  "PULL_ARTIFACT",
  "DELETE_ARTIFACT",
  "SCANNING_COMPLETED",
  "SCANNING_FAILED",
];
const defaultEvents = new Set(["PUSH_ARTIFACT", "SCANNING_COMPLETED"]);

const eventLabels: Record<string, string> = {
  PUSH_ARTIFACT: "推送制品",
  PULL_ARTIFACT: "拉取制品",
  DELETE_ARTIFACT: "删除制品",
  SCANNING_COMPLETED: "扫描完成",
  SCANNING_FAILED: "扫描失败",
  QUOTA_EXCEED: "配额超限",
  TAG_RETENTION: "Tag 保留执行",
};

function webhookEventLabel(value: string): string {
  return eventLabels[value] ?? value;
}

export function ProjectWebhookDialog({
  project,
  webhook,
  metadata,
  onClose,
  onSaved,
}: {
  project: string;
  webhook?: ProjectWebhook;
  metadata: WebhookEventMetadata;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useLocale();
  const target = webhook?.targets?.[0];
  const events = metadata.event_type?.length
    ? metadata.event_type
    : fallbackEvents;
  const payloadFormats = metadata.payload_formats?.find(
    (item) => item.notify_type === "http",
  )?.formats ?? ["Default", "CloudEvents"];
  const defaultPayloadFormat = payloadFormats.at(0) ?? "Default";
  const [name, setName] = useState(webhook?.name ?? "");
  const [description, setDescription] = useState(webhook?.description ?? "");
  const [address, setAddress] = useState(target?.address ?? "");
  const [authHeader, setAuthHeader] = useState(target?.auth_header ?? "");
  const [payloadFormat, setPayloadFormat] = useState(
    target?.payload_format ?? defaultPayloadFormat,
  );
  const [enabled, setEnabled] = useState(webhook?.enabled !== false);
  const [skipCertificateVerification, setSkipCertificateVerification] =
    useState(target?.skip_cert_verify === true);
  const [selectedEvents, setSelectedEvents] = useState(
    () =>
      new Set(
        webhook?.event_types?.length
          ? webhook.event_types.filter((eventName) =>
              events.includes(eventName),
            )
          : events.filter((eventName) => defaultEvents.has(eventName)),
      ),
  );

  return (
    <ControlDialog
      title={webhook ? "编辑 Webhook" : "新建 Webhook"}
      subtitle={project}
      submitLabel={webhook ? "保存 Webhook" : "创建 Webhook"}
      onClose={onClose}
      onSubmit={async () => {
        if (!selectedEvents.size) {
          throw new Error(t("请至少选择一种事件类型"));
        }
        const payload = {
          name: name.trim(),
          description: description.trim(),
          enabled,
          event_types: Array.from(selectedEvents),
          targets: [
            {
              type: "http",
              address: address.trim(),
              auth_header: authHeader,
              skip_cert_verify: skipCertificateVerification,
              payload_format: payloadFormat,
            },
          ],
        };
        await controlApi.mutate(
          webhook ? "webhook" : "webhooks",
          webhook ? { project, id: webhook.id } : { project },
          webhook ? "PUT" : "POST",
          payload,
        );
        onSaved();
      }}
    >
      <div className="form-grid two-columns">
        <label className="field">
          <span>{t("名称")}</span>
          <input
            name="name"
            required
            maxLength={255}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>{t("负载格式")}</span>
          <UnifiedSelect
            ariaLabel={t("负载格式")}
            name="payload_format"
            value={payloadFormat}
            options={payloadFormats.map((format) => ({
              value: format,
              label: format,
            }))}
            onChange={setPayloadFormat}
          />
        </label>
        <label className="field field-span">
          <span>{t("目标地址")}</span>
          <input
            name="address"
            type="url"
            required
            value={address}
            placeholder="https://hooks.example.com/harbor"
            onChange={(event) => setAddress(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("Authorization 请求头")}</span>
          <input
            name="auth_header"
            value={authHeader}
            autoComplete="off"
            placeholder={t("可选")}
            onChange={(event) => setAuthHeader(event.currentTarget.value)}
          />
        </label>
        <label className="field field-span">
          <span>{t("描述")}</span>
          <input
            name="description"
            maxLength={1024}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </label>
      </div>
      <fieldset className="event-selector">
        <legend>{t("事件类型")}</legend>
        {events.map((eventName) => (
          <label className="check-row" key={eventName}>
            <input
              type="checkbox"
              checked={selectedEvents.has(eventName)}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setSelectedEvents((current) => {
                  const next = new Set(current);
                  if (checked) next.add(eventName);
                  else next.delete(eventName);
                  return next;
                });
              }}
            />
            <span>
              <strong>{t(webhookEventLabel(eventName))}</strong>
              <small>{eventName}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="check-grid">
        <label className="check-row">
          <input
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
          />
          <span>
            <strong>{t("启用 Webhook")}</strong>
          </span>
        </label>
        <label className="check-row">
          <input
            name="skip_cert_verify"
            type="checkbox"
            checked={skipCertificateVerification}
            onChange={(event) =>
              setSkipCertificateVerification(event.currentTarget.checked)
            }
          />
          <span>
            <strong>{t("跳过 TLS 验证")}</strong>
          </span>
        </label>
      </div>
    </ControlDialog>
  );
}

export function DeleteProjectWebhookDialog({
  project,
  webhook,
  onClose,
  onDeleted,
}: {
  project: string;
  webhook: ProjectWebhook;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale, t } = useLocale();
  const subtitle =
    locale === "en-US"
      ? `Webhook ${webhook.name} will stop sending events.`
      : `Webhook ${webhook.name} 将停止发送事件。`;
  return (
    <ControlDialog
      title="删除 Webhook"
      subtitle={subtitle}
      submitLabel="删除 Webhook"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await controlApi.mutate(
          "webhook",
          { project, id: webhook.id },
          "DELETE",
        );
        onDeleted();
      }}
    >
      <div className="notice notice-danger">
        <Icon name="alert" />
        <span>{t("此操作无法撤销")}</span>
      </div>
    </ControlDialog>
  );
}
