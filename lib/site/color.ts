export function inkOn(color: string): string {
  const hex = color.trim().replace("#", "");

  const full = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex.slice(0, 6);

  const value = Number.parseInt(full, 16);

  if (!Number.isFinite(value) || full.length !== 6) {
    return "#f2f2f3";
  }

  const red = (value >> 16) & 255;

  const green = (value >> 8) & 255;

  const blue = value & 255;

  const luma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luma > 0.62 ? "#16161a" : "#f4f4f5";
}

export function muteOn(color: string): string {
  return inkOn(color) === "#16161a"
    ? "rgb(22 22 26 / 0.62)"
    : "rgb(244 244 245 / 0.72)";
}
