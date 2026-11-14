// Vercel Function handlers (Web Request/Response). Bundled by scripts/build-api.mjs into
// self-contained files under api/, so no TypeScript, JSON or path resolution happens at runtime.
// Configuration comes from the project's environment variables (Vercel dashboard or `vercel env`):
//   GEMINI_API_KEY (required for live answers)  GEMINI_MODEL  GEMINI_THINKING
//   EMBER_PER_VISITOR_LIMIT  EMBER_WINDOW_MINUTES  EMBER_DAILY_LIMIT  EMBER_AI_OFF=1
import { createApi, visitorId } from "./api";
import { parseModelList } from "./gemini";

const env = process.env;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const thinking = env.GEMINI_THINKING || "low";

const api = createApi({
  apiKey: env.EMBER_AI_OFF === "1" ? undefined : env.GEMINI_API_KEY,
  models: parseModelList(env.GEMINI_MODEL),
  thinkingLevel: thinking === "default" ? undefined : thinking,
  perVisitorLimit: num(env.EMBER_PER_VISITOR_LIMIT, 6),
  perVisitorWindowS: num(env.EMBER_WINDOW_MINUTES, 10) * 60,
  dailyLimit: num(env.EMBER_DAILY_LIMIT, 250),
});

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function handle(req: Request): Promise<Response> {
  const path = new URL(req.url).pathname;
  const body = req.method === "POST" ? (await req.text()).slice(0, 20_001) : "";
  const out = await api.handle({ method: req.method, path, body, visitor: await visitorId(clientIp(req)) });
  if (!out) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(out.body, { status: out.status, headers: out.headers });
}
