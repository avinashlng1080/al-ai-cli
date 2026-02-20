import { createHighlighter, type Highlighter, type BundledLanguage } from "shiki";

let highlighter: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

const LANGUAGE_MAP: Record<string, BundledLanguage> = {
  js: "javascript",
  ts: "typescript",
  tsx: "tsx",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  html: "html",
  css: "css",
  sql: "sql",
  dockerfile: "dockerfile",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  cs: "csharp",
  swift: "swift",
  kotlin: "kotlin",
  php: "php",
  lua: "lua",
  vim: "vim",
  xml: "xml",
  graphql: "graphql",
};

async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  if (initPromise) return initPromise;

  initPromise = createHighlighter({
    themes: ["github-dark"],
    langs: [
      "javascript",
      "typescript",
      "tsx",
      "jsx",
      "python",
      "bash",
      "json",
      "yaml",
      "html",
      "css",
      "markdown",
      "go",
      "rust",
      "java",
      "c",
      "cpp",
      "sql",
    ],
  });

  highlighter = await initPromise;
  return highlighter;
}

/**
 * Highlight code for terminal output.
 * Returns ANSI-colored string if possible, falls back to plain text.
 */
export async function highlightCode(
  code: string,
  language: string,
): Promise<string> {
  try {
    const hl = await getHighlighter();
    const lang = LANGUAGE_MAP[language.toLowerCase()] ?? language.toLowerCase();

    // Check if language is loaded
    const loadedLangs = hl.getLoadedLanguages();
    if (!loadedLangs.includes(lang as BundledLanguage)) {
      return addLineNumbers(code);
    }

    const result = hl.codeToHtml(code, {
      lang: lang as BundledLanguage,
      theme: "github-dark",
    });

    // Strip HTML tags for terminal output (shiki produces HTML)
    const plainText = result
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    return addLineNumbers(plainText);
  } catch {
    return addLineNumbers(code);
  }
}

function addLineNumbers(code: string): string {
  const lines = code.split("\n");
  const width = String(lines.length).length;
  return lines
    .map((line, i) => {
      const num = String(i + 1).padStart(width);
      return `\x1b[90m${num}\x1b[0m │ ${line}`;
    })
    .join("\n");
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_MAP[ext] ?? ext;
}
