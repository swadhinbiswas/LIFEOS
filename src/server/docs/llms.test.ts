import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt, buildLlmsTxt } from "./llms";

/**
 * `/llms.txt` and `/llms-full.txt` must describe what the app actually serves (spec §9.2). These
 * tests pin the contract an agent relies on: the OpenAPI URL, the auth header and every MCP tool —
 * so adding a tool without documenting it fails here.
 */
describe("llms.txt", () => {
  it("indexes the docs and the API entry points", async () => {
    const text = await buildLlmsTxt("https://lifeos.example");
    expect(text).toContain("# LifeOS");
    expect(text).toContain("https://lifeos.example/api/v1/openapi.json");
    expect(text).toContain("https://lifeos.example/docs/api");
    expect(text).toContain("Bearer lifeos_live_");
    expect(text).toContain("POST https://lifeos.example/api/v1/ingest");
    expect(text).toContain("/docs/architecture");
    expect(text).toContain("/docs/api");
  });

  it("lists every MCP tool with its description", async () => {
    const { MCP_TOOLS } = await import("@/server/api/mcp/tools");
    const text = await buildLlmsTxt("https://lifeos.example");
    for (const tool of MCP_TOOLS) {
      expect(text).toContain(`\`${tool.name}\`:`);
    }
    for (const name of ["list_resumes", "get_resume", "propose_resume_edit", "move_card"]) {
      expect(text).toContain(`\`${name}\``);
    }
  });

  it("inlines the documents for one-shot context", async () => {
    const text = await buildLlmsFullTxt("https://lifeos.example");
    expect(text).toContain("<!-- source: docs/API.md -->");
    expect(text).toContain("<!-- source: docs/THEMING.md -->");
    expect(text).toContain("## Authentication");
    expect(text.length).toBeGreaterThan(4_000);
  });
});
