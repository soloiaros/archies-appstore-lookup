const regions = new Intl.DisplayNames(["en"], {
  type: "region",
});

export function regionName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "Unknown";
  }

  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}

export function regionFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) {
    return "";
  }

  return [...code]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}
