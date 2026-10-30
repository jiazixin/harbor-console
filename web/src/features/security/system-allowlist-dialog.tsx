import type { CveAllowlist } from "../../app/models";
import { ControlDialog } from "../../components/control-dialog";
import {
  CveAllowlistEditor,
  useCveAllowlistDraft,
} from "../../components/cve-allowlist-editor";

import { useControlMutation } from "../../app/use-control-mutation";
import { affectedQueries } from "./security-dialogs-support";

type SystemAllowlistDialogProps = {
  allowlist: CveAllowlist;
  onClose: () => void;
  onSaved: () => void;
};

export function SystemAllowlistDialog({
  allowlist,
  onClose,
  onSaved,
}: SystemAllowlistDialogProps) {
  const mutate = useControlMutation(affectedQueries);
  const draft = useCveAllowlistDraft(allowlist);
  return (
    <ControlDialog
      title="编辑系统 CVE 白名单"
      subtitle="对使用系统白名单的全部项目生效"
      submitLabel="保存白名单"
      onClose={onClose}
      onSubmit={async () => {
        await mutate({
          operation: "system-cve-allowlist",
          parameters: {},
          method: "PUT",
          payload: draft.toPayload(),
        });
        onSaved();
      }}
    >
      <CveAllowlistEditor {...draft.editorProps} />
    </ControlDialog>
  );
}
