import { useLocale } from "../app/locale-context";

export function HarborBrand({
  compact = false,
  href = "#/overview",
  label = "控制台",
  ariaLabel = "Harbor 控制台",
  onClick,
}: {
  compact?: boolean;
  href?: string;
  label?: string;
  ariaLabel?: string;
  onClick?: () => void;
}) {
  const { t } = useLocale();
  return (
    <a
      className="brand"
      href={href}
      aria-label={t(ariaLabel)}
      onClick={(event) => {
        if (!onClick) return;
        event.preventDefault();
        onClick();
      }}
    >
      <span
        className={`brand-mark${compact ? " brand-mark-small" : ""}`}
        aria-hidden="true"
      >
        <img src="/favicon.svg" alt="" />
      </span>
      <span className="brand-text">
        Harbor <b>{t(label)}</b>
      </span>
    </a>
  );
}
