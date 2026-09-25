export function Indicator({
  on = false,
}: {
  on?: boolean;
}) {
  return (
    <span
      className="ui-led"
      data-on={on ? "true" : "false"}
      aria-hidden
    />
  );
}
