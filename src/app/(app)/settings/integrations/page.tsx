import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listApiKeys, toKeySummary } from "@/server/api-keys";

import { ApiKeys } from "./_components/api-keys";

export const metadata = { title: "Integrations" };

/**
 * `/settings/integrations` (spec §9.1, MVP #33, ADR-062): personal API keys for the REST API and
 * the MCP server. A key is shown once, stored hashed, scoped and instantly revocable.
 */
export default async function IntegrationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const keys = (await listApiKeys(session.user.id)).map(toKeySummary);
  const active = keys.filter((key) => !key.revoked).length;

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        Integrations
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title="API keys" hint={`${active} active`}>
          <p className="font-mono text-[10px] text-muted-foreground">
            personal keys for the REST API and the MCP server — shown once, stored as a SHA-256
            hash, scoped and revocable.
          </p>
          <ApiKeys keys={keys} />
        </Panel>
      </div>
    </>
  );
}
