import { useEffect, useRef, useState } from "react";
import { searchApi } from "../app/api-client";
import { useLocale } from "../app/locale-context";
import type { SearchResults } from "../app/models";
import { useLoadedQuery } from "../app/use-loaded-query";
import { FormInput } from "../components/form-input";
import { Icon } from "../components/icon";
import uiStyles0 from "../components/shared-ui.module.css";
import { useModal } from "../components/use-modal";
import { createClassNames } from "../lib/css/class-names";
import { formatNumber } from "../lib/format/formatters";
import uiStyles1 from "./global-search-dialog.module.css";
import { shellKeys } from "./shell-keys";

type GlobalSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
};

export function GlobalSearchDialog({
  open,
  onClose,
  navigate,
}: GlobalSearchDialogProps) {
  const { locale, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [term, setTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useModal({
    open,
    dialogRef,
    onClose,
    initialFocusSelector: 'input[type="search"]',
  });

  // Every opening starts from an empty search.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTerm("");
      setSearchTerm("");
    }
  }

  // Search once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(term.trim());
    }, 260);
    return () => {
      window.clearTimeout(timer);
    };
  }, [term]);

  const searchQuery = useLoadedQuery(
    shellKeys.search(searchTerm),
    (signal) => searchApi.search(searchTerm, signal),
    { enabled: open && searchTerm.length >= 2 },
  );
  const active = open && term.trim().length >= 2;
  const results: SearchResults | undefined = active
    ? searchQuery.data
    : undefined;
  const error = active ? searchQuery.error : "";
  const loading = active && searchQuery.loading;

  if (!open) return null;
  const projects = results?.project ?? [];
  const repositories = results?.repository ?? [];
  const hasResults = projects.length > 0 || repositories.length > 0;
  return (
    <div
      className={resolveClasses("dialog-backdrop")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className={resolveClasses("search-dialog")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="react-search-title"
      >
        <h2 id="react-search-title" className={resolveClasses("sr-only")}>
          {t("全局搜索")}
        </h2>
        <div className={resolveClasses("search-input-row")}>
          <Icon name="search" />
          <FormInput
            ref={inputRef}
            type="search"
            value={term}
            maxLength={200}
            placeholder={t("搜索项目或仓库...")}
            autoComplete="off"
            onChange={(event) => {
              setTerm(event.currentTarget.value);
            }}
          />
          <button
            className={resolveClasses("icon-button")}
            type="button"
            aria-label={t("关闭搜索")}
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className={resolveClasses("search-results")}>
          {(() => {
            if (term.trim().length < 2) {
              return (
                <div className={resolveClasses("search-hint")}>
                  {t("输入至少两个字符开始搜索")}
                </div>
              );
            }
            if (loading) {
              return (
                <div className={resolveClasses("search-hint")}>
                  <div className={resolveClasses("spinner")} />
                  {t("正在搜索...")}
                </div>
              );
            }
            if (error) {
              return (
                <div className={resolveClasses("search-hint")}>{error}</div>
              );
            }
            if (!hasResults) {
              return (
                <div className={resolveClasses("search-hint")}>
                  {t("没有找到匹配的项目或仓库")}
                </div>
              );
            }
            return (
              <>
                {projects.length ? (
                  <>
                    <span className={resolveClasses("search-group-label")}>
                      {t("项目")}
                    </span>
                    {projects.map((project) => (
                      <button
                        className={resolveClasses("search-result")}
                        key={`project-${project.name}`}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(
                            `projects/${encodeURIComponent(project.name)}`,
                          );
                        }}
                      >
                        <span className={resolveClasses("cell-stack")}>
                          <strong>{project.name}</strong>
                          <small>{t("项目")}</small>
                        </span>
                        <Icon name="arrow-right" />
                      </button>
                    ))}
                  </>
                ) : null}
                {repositories.length ? (
                  <>
                    <span className={resolveClasses("search-group-label")}>
                      {t("仓库")}
                    </span>
                    {repositories.map((repository) => {
                      const name = repository.repository_name;
                      const project = repository.project_name ?? "";
                      return (
                        <button
                          className={resolveClasses("search-result")}
                          key={`repository-${project}-${name}`}
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(
                              `projects/${encodeURIComponent(project)}/repositories/${encodeURIComponent(name)}/artifacts`,
                            );
                          }}
                        >
                          <span className={resolveClasses("cell-stack")}>
                            <strong>{name}</strong>
                            <small>
                              {locale === "en-US"
                                ? `${formatNumber(repository.artifact_count, locale)} artifacts`
                                : `${formatNumber(repository.artifact_count, locale)} 个制品`}
                            </small>
                          </span>
                          <Icon name="arrow-right" />
                        </button>
                      );
                    })}
                  </>
                ) : null}
              </>
            );
          })()}
        </div>
      </section>
    </div>
  );
}

const resolveClasses = createClassNames({
  icon: uiStyles0.icon,
  "dialog-backdrop": uiStyles0.dialogBackdrop,
  "sr-only": uiStyles0.srOnly,
  "icon-button": uiStyles0.iconButton,
  button: uiStyles0.button,
  spinner: uiStyles0.spinner,
  "cell-stack": uiStyles0.cellStack,
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
  "search-dialog": uiStyles1.searchDialog,
  "search-input-row": uiStyles1.searchInputRow,
  "search-results": uiStyles1.searchResults,
  "search-hint": uiStyles1.searchHint,
  "search-group-label": uiStyles1.searchGroupLabel,
  "search-result": uiStyles1.searchResult,
});
