// Connect-style middleware so the Vite dev and preview servers serve the same API as Vercel.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApi, visitorId, type ApiConfig } from "./api";

export function analysisMiddleware(cfg: ApiConfig) {
  const api = createApi(cfg);
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url?.split("?")[0] ?? "";
    if (!path.startsWith("/api/")) return next();
    // Read the whole stream (so the client is never left hanging) but keep at most 20 KB + 1.
    let body = "";
    for await (const chunk of req) if (body.length <= 20_000) body += chunk;
    const out = await api.handle({ method: req.method ?? "GET", path, body, visitor: await visitorId(req.socket.remoteAddress ?? "local") });
    if (!out) return next();
    res.statusCode = out.status;
    res.setHeader("Content-Type", "application/json");
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
    res.end(JSON.stringify(out.body));
  };
}
