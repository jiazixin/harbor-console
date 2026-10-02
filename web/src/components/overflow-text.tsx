import type { HTMLAttributes } from "react";

type OverflowTextProps = HTMLAttributes<HTMLElement> & {
  as?: "code" | "small" | "span" | "strong";
  children: string;
};

export function OverflowText({
  as,
  children,
  className = "",
  ...props
}: OverflowTextProps) {
  const Component = as ?? "span";
  return (
    <Component
      className={`overflow-text${className ? ` ${className}` : ""}`}
      title={children}
      {...props}
    >
      {children}
    </Component>
  );
}
