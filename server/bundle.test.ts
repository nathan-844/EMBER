import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Vercel function bundles", () => {
  it("api/*.mjs match the current server source (run npm run build:api if this fails)", () => {
    const out = execFileSync(process.execPath, ["scripts/build-api.mjs", "--check"], { encoding: "utf8" });
    expect(out).not.toMatch(/out of date/);
  }, 60_000);
});
