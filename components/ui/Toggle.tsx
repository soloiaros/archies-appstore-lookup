import type { ButtonHTMLAttributes } from "react";

type ToggleProps = {
  checked: boolean;

  onLabel?: string;

  offLabel?: string;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "role" | "aria-checked" | "type"
>;

export function Toggle({
  checked,
  onLabel = "ON",
  offLabel = "OFF",
  className,
  ...rest
}: ToggleProps) {
  const classes = className ? `ui-toggle ${className}` : "ui-toggle";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes}
      data-on={checked ? "true" : "false"}
      {...rest}
    >
      <span className="ui-toggle-thumb">
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}
