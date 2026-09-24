/** App Store glyph mark. */
export function StoreMark({
  size = 13,
}: {
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      focusable="false"
    >
      <rect
        width="100"
        height="100"
        rx="18"
        fill="#f4f4f5"
      />

      <path
        d="M50 18c-7 12-18 20-18 34a18 18 0 0 0 36 0c0-14-11-22-18-34Z"
        fill="#0b0b0c"
      />

      <path
        d="M38 78h24M42 86h16"
        stroke="#0b0b0c"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
