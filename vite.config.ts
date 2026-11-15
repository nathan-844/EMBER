import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { build } from "esbuild";
import { resolve } from "node:path";
import { analysisMiddleware } from "./server/middleware";
import { parseModelList } from "./server/gemini";

/** Export the current engine, never a separately maintained copy. */
function reproductionEngine(): Plugin {
  const id = "virtual:analysis-engine";
  return {
    name: "ember-reproduction-engine",
    resolveId(source) { if (source === id) return "\0" + id; },
    async load(source) {
      if (source !== "\0" + id) return;
      const result = await build({ entryPoints: [resolve("src/lib/analysis/standalone.ts")], bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", metafile: true });
      for (const input of Object.keys(result.metafile!.inputs)) this.addWatchFile(resolve(input));
      return `export default ${JSON.stringify(result.outputFiles[0].text)};`;
    },
  };
}

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
    plugins: [react(), reproductionEngine(), emberApi(process.env.EMBER_AI_OFF === "1" || mode === "demo" ? undefined : env.GEMINI_API_KEY || process.env.GEMINI_API_KEY, env.GEMINI_MODEL || process.env.GEMINI_MODEL || "", env.GEMINI_THINKING || process.env.GEMINI_THINKING || "low")],
    test: {
      include: ["src/**/*.test.ts", "server/**/*.test.ts"],
    },
  } as any;
});
