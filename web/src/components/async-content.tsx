import { Component, Suspense, type ReactNode } from "react";
import { useLocale } from "../app/locale-context";
import { ControlDialog } from "./control-dialog";
import { ErrorView } from "./error-view";
import { LoadingView } from "./loading-view";

type AsyncContentProps = {
  children: ReactNode;
  resetKey: string;
  onClose?: () => void;
};

type AsyncContentStateProps = {
  failed?: boolean;
  onClose?: () => void;
};

function AsyncContentState({
  failed = false,
  onClose,
}: AsyncContentStateProps) {
  const { t } = useLocale();
  const reload = () => {
    window.location.reload();
  };
  if (onClose) {
    // Dialog modules load on demand; the placeholder keeps the overlay open
    // and closable while the module downloads.
    return (
      <ControlDialog
        title={failed ? "无法打开对话框" : "正在打开对话框"}
        submitLabel="重新加载"
        submitDisabled={!failed}
        onClose={onClose}
        onSubmit={reload}
        initialFocusSelector={null}
      >
        <p role={failed ? "alert" : "status"}>
          {t(
            failed
              ? "加载对话框时发生错误。请重新加载页面后重试。"
              : "正在准备对话框内容...",
          )}
        </p>
      </ControlDialog>
    );
  }
  const title = failed ? "无法加载页面" : "正在加载页面";
  const message = failed
    ? "加载页面时发生错误。请重新加载后重试。"
    : "正在准备页面内容...";
  return failed ? (
    <ErrorView title={title} message={t(message)} retry={reload} />
  ) : (
    <LoadingView title={title} description={message} />
  );
}

class ContentErrorBoundary extends Component<
  AsyncContentProps,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidUpdate(previous: AsyncContentProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  override render() {
    return this.state.failed ? (
      <AsyncContentState failed onClose={this.props.onClose} />
    ) : (
      this.props.children
    );
  }
}

export function AsyncContent(props: AsyncContentProps) {
  return (
    <ContentErrorBoundary {...props}>
      <Suspense fallback={<AsyncContentState onClose={props.onClose} />}>
        {props.children}
      </Suspense>
    </ContentErrorBoundary>
  );
}
