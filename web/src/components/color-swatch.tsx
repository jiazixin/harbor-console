import styles from "./color-swatch.module.css";

type ColorSwatchProps = { color?: string; className?: string };

/** Harbor label colors are validated data, rendered as an SVG paint attribute. */
export function ColorSwatch({ color, className = "" }: ColorSwatchProps) {
  const fill = /^#[\da-f]{6}$/i.test(color ?? "") ? color : undefined;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`${styles.swatch} ${className}`}
    >
      <rect width="12" height="12" rx="6" fill={fill} />
    </svg>
  );
}
