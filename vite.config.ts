import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { analysisMiddleware } from "./server/middleware";
import { parseModelList } from "./server/gemini";

/** Serves /api/ai-status and /api/analyze from the dev and preview servers. */
function emberApi(apiKey: string | undefined, models: string, thinkingLevel: string): Plugin {
  const mw = analysisMiddleware({ apiKey, models: parseModelList(models), thinkingLevel: thinkingLevel === "default" ? undefined : thinkingLevel });
  return {
    name: "ember-api",
    configureServer(server) {
      server.middlewares.use(mw);
    },
    configurePreviewServer(server) {
      server.middlewares.use(mw);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env / .env.local without exposing anything to the browser bundle (no VITE_ prefix).
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // EMBER_AI_OFF=1 serves only recorded answers (used for the demo video and keyless hosting checks).
    plugins: [react(), emberApi(process.env.EMBER_AI_OFF === "1" || mode === "demo" ? undefined : env.GEMINI_API_KEY || process.env.GEMINI_API_KEY, env.GEMINI_MODEL || process.env.GEMINI_MODEL || "", env.GEMINI_THINKING || process.env.GEMINI_THINKING || "low")],
    test: {
      include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    },
  } as any;
});
