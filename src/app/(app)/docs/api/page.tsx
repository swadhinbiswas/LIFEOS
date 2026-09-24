import Link from "next/link";

import { Panel } from "@/components/tui/panel";
import { openApiDocument } from "@/server/api/openapi";

export const metadata = { title: "API reference" };

interface Operation {
  summary?: string;
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
}
interface Spec {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}

const METHODS = new Set(["get", "post", "patch", "delete", "put"]);

/**
 * `/docs/api` (spec §9.1, ADR-067): a server-rendered reference generated from the same OpenAPI
 * document served at `/api/v1/openapi.json` — no client-side docs bundle, themed like the rest of
 * the app, and every operation is real because the document is derived from the route schemas.
 */
export default function ApiDocsPage() {
  const doc = openApiDocument() as unknown as Spec;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        API reference
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="OpenAPI" hint={doc.openapi}>
          <p className="font-mono text-[10px] text-muted-foreground">
            machine-readable spec at{" "}
            <Link href="/api/v1/openapi.json" className="text-primary underline">
              /api/v1/openapi.json
            </Link>
            . Authenticate with a Bearer key from{" "}
            <Link href="/settings/integrations" className="text-primary underline">
              Integrations
            </Link>
            ; session cookies also work in the browser.
          </p>
        </Panel>

        {Object.entries(doc.paths).map(([path, methods]) => (
          <Panel key={path} title={path}>
            <ul className="flex flex-col gap-2">
              {Object.entries(methods)
                .filter(([method]) => METHODS.has(method))
                .map(([method, operation]) => (
                  <li
                    key={method}
                    data-slot="api-operation"
                    className="flex flex-col gap-1 border border-border px-2 py-1"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className="text-primary uppercase">{method}</span>
                      <span>{operation.summary}</span>
                    </div>
                    {operation.parameters && operation.parameters.length > 0 ? (
                      <ul className="flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground">
                        {operation.parameters.map((parameter) => (
                          <li key={parameter.name}>
                            {parameter.in}: {parameter.name}
                            {parameter.required ? " (required)" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
            </ul>
          </Panel>
        ))}

        <Panel title="Schemas" hint={`${Object.keys(doc.components.schemas).length}`}>
          <ul className="flex flex-wrap gap-2 font-mono text-xs">
            {Object.keys(doc.components.schemas).map((name) => (
              <li key={name} className="border border-border px-2 py-0.5">
                {name}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
