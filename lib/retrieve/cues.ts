const COLOR_WORD =
  /\b(red|orange|yellow|green|blue|purple|violet|pink|brown|black|white|gr[ae]y|beige|cream|teal|cyan|navy|lime|gold|silver|magenta|maroon|turquoise|indigo|dark|light|bright|pastel|neon|colou?r\w*)\b/i;

const LETTER_WORDS = new Set(
  "letter letters text texts word words writing written write say says saying spelled printed reads read".split(
    " ",
  ),
);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

export function queryMentionsColor(query: string) {
  return COLOR_WORD.test(query);
}

export function queryMentionsLetters(query: string) {
  return tokenize(query).some((word) => LETTER_WORDS.has(word));
}
