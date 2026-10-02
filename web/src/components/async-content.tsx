import { Component, Suspense, type ReactNode } from "react";

import { useLocale } from "../app/locale-context";
import { ControlDialog } from "./control-dialog";
import { ErrorView, LoadingView } from "./feedback";

type AsyncContentProps = {
  children: ReactNode;
  resetKey: string;
  onClose?: () => void;
};

function AsyncContentState({
  failed = false,
  onClose,
}: {
  failed?: boolean;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const reload = () => window.location.reload();
  const title = failed ? "无法加载页面" : "正在加载页面";
  const message = failed
    ? "加载页面时发生错误。请重新加载后重试。"
    : "正在准备页面内容...";
  if (onClose) {
    return (
      <ControlDialog
        title={title}
        submitLabel="重试"
        submitDisabled={!failed}
        onClose={onClose}
        onSubmit={reload}
        initialFocusSelector={null}
      >
        <p role={failed ? "alert" : "status"}>{t(message)}</p>
      </ControlDialog>
    );
  }
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
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: AsyncContentProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
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
