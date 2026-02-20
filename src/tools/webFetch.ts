import type { Tool } from "../config/types.js";

export const webFetchTool: Tool = {
  name: "webFetch",
  description:
    "Fetch content from a URL. Returns the response body as text. Useful for reading documentation, APIs, or web pages.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      method: {
        type: "string",
        description: "HTTP method (default: GET)",
        enum: ["GET", "POST", "PUT", "DELETE"],
      },
      headers: {
        type: "object",
        description: "Additional headers to send",
      },
      body: {
        type: "string",
        description: "Request body (for POST/PUT)",
      },
    },
    required: ["url"],
  },
};

export async function executeWebFetch(args: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<string> {
  const response = await fetch(args.url, {
    method: args.method ?? "GET",
    headers: args.headers,
    body: args.body,
    signal: AbortSignal.timeout(30_000),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  // Truncate very large responses
  const maxLength = 50_000;
  const truncated =
    text.length > maxLength
      ? text.slice(0, maxLength) + "\n... (truncated)"
      : text;

  return `HTTP ${response.status}\nContent-Type: ${contentType}\n\n${truncated}`;
}
