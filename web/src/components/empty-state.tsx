import type { ComponentProps } from "react";

import { useLocale } from "../app/locale-context";
import { Icon, type IconName } from "./icons";

export function EmptyState({
  title,
  description,
  icon,
  className = "",
  ...props
}: {
  title: string;
  description?: string;
  icon?: IconName;
} & ComponentProps<"div">) {
  const { t } = useLocale();
  return (
    <div className={`empty-state ${className}`.trim()} {...props}>
      <div>
        {icon ? (
          <span className="state-icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
        ) : null}
        <h2>{t(title)}</h2>
        {description ? <p>{t(description)}</p> : null}
      </div>
    </div>
  );
}
