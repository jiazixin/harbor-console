import { DeletePreheatInstanceDialog } from "../features/preheat/delete-preheat-instance-dialog";
import { PreheatInstanceDialog } from "../features/preheat/preheat-instance-dialog";
import { DeleteRegistryDialog } from "../features/registries/delete-registry-dialog";
import { RegistryDialog } from "../features/registries/registry-dialog";
import { ReplicationDialogHost } from "../features/replication/replication-dialog-host";
import { CveExportDetailDialog } from "../features/security/cve-export-detail-dialog";
import { CveExportDialog } from "../features/security/cve-export-dialog";
import { DeleteScannerDialog } from "../features/security/delete-scanner-dialog";
import { ScannerDialog } from "../features/security/scanner-dialog";
import { ScannerMetadataDialog } from "../features/security/scanner-metadata-dialog";
import { SystemAllowlistDialog } from "../features/security/system-allowlist-dialog";
import { type DialogRouteProps } from "./resource-dialog-routes-support";

/** Scanner, CVE, remote registry, replication and P2P instance dialogs. */
export function SystemDialogRoute({ dialog, controls }: DialogRouteProps) {
  const { close, complete, notify } = controls;
  const changed =
    (reload: "preheat" | "registries" | "replication" | "security") =>
    (message: string) => {
      complete(message, { reload, refreshConsole: true });
    };
  const securityChanged = changed("security");
  const registriesChanged = changed("registries");
  const preheatChanged = changed("preheat");

  switch (dialog.kind) {
    case "security": {
      const action = dialog.action;
      switch (action.kind) {
        case "create-scanner":
          return (
            <ScannerDialog
              canDisable={action.canDisable}
              onClose={close}
              onSaved={() => {
                securityChanged("扫描器已注册");
              }}
            />
          );
        case "edit-scanner":
          return (
            <ScannerDialog
              scanner={action.scanner}
              onClose={close}
              onSaved={() => {
                securityChanged("扫描器已更新");
              }}
            />
          );
        case "scanner-metadata":
          return (
            <ScannerMetadataDialog scanner={action.scanner} onClose={close} />
          );
        case "delete-scanner":
          return (
            <DeleteScannerDialog
              scanner={action.scanner}
              onClose={close}
              onDeleted={() => {
                securityChanged("扫描器已删除");
              }}
            />
          );
        case "edit-allowlist":
          return (
            <SystemAllowlistDialog
              allowlist={action.allowlist}
              onClose={close}
              onSaved={() => {
                securityChanged("系统 CVE 白名单已保存");
              }}
            />
          );
        case "create-export":
          return (
            <CveExportDialog
              projects={action.projects}
              onClose={close}
              onCreated={(id) => {
                securityChanged(`CVE 导出任务 #${String(id ?? "-")} 已创建`);
              }}
            />
          );
        case "export-detail":
          return (
            <CveExportDetailDialog
              execution={action.execution}
              onClose={close}
            />
          );
        default:
          return null;
      }
    }
    case "registry": {
      const action = dialog.action;
      switch (action.kind) {
        case "create":
          return (
            <RegistryDialog
              adapters={action.adapters}
              adapterInfos={action.adapterInfos}
              onClose={close}
              onSaved={() => {
                registriesChanged("远端仓库已创建");
              }}
              onNotice={notify}
            />
          );
        case "edit":
          return (
            <RegistryDialog
              registry={action.registry}
              adapters={action.adapters}
              adapterInfos={action.adapterInfos}
              onClose={close}
              onSaved={() => {
                registriesChanged("远端仓库已更新");
              }}
              onNotice={notify}
            />
          );
        case "delete":
          return (
            <DeleteRegistryDialog
              registry={action.registry}
              onClose={close}
              onDeleted={() => {
                registriesChanged("远端仓库连接已删除");
              }}
            />
          );
        default:
          return null;
      }
    }
    case "replication":
      return (
        <ReplicationDialogHost
          action={dialog.action}
          onClose={close}
          onChanged={changed("replication")}
          onNotice={notify}
        />
      );
    case "preheat-instance": {
      const action = dialog.action;
      switch (action.kind) {
        case "create":
          return (
            <PreheatInstanceDialog
              providers={action.providers}
              onClose={close}
              onSaved={() => {
                preheatChanged("P2P 实例已创建");
              }}
              onNotice={notify}
            />
          );
        case "edit":
          return (
            <PreheatInstanceDialog
              instance={action.instance}
              providers={action.providers}
              onClose={close}
              onSaved={() => {
                preheatChanged("P2P 实例已更新");
              }}
              onNotice={notify}
            />
          );
        case "delete":
          return (
            <DeletePreheatInstanceDialog
              instance={action.instance}
              onClose={close}
              onDeleted={() => {
                preheatChanged("P2P 实例已删除");
              }}
            />
          );
        default:
          return null;
      }
    }
    default:
      return null;
  }
}
