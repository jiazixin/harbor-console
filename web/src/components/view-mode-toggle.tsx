import { Icon } from "./icons";

type ViewMode = "card" | "list";

export function ViewModeToggle({
  value,
  ariaLabel,
  listLabel,
  cardLabel,
  onChange,
}: {
  value: ViewMode;
  ariaLabel: string;
  listLabel: string;
  cardLabel: string;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="view-mode-toggle" role="group" aria-label={ariaLabel}>
      {(["list", "card"] as const).map((mode) => {
        const label = mode === "list" ? listLabel : cardLabel;
        return (
          <button
            key={mode}
            type="button"
            className={value === mode ? "active" : ""}
            title={label}
            aria-label={label}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
          >
            <Icon name={mode === "list" ? "list" : "grid"} />
          </button>
        );
      })}
    </div>
  );
}
