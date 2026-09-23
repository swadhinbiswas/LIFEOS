import { Panel } from "@/components/tui/panel";

import { VerifyEmailNotice } from "../_components/verify-email-notice";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  // The client notice consumes the token once on mount (StrictMode-safe ref guard);
  // verifying during render would burn the single-use token twice in development.
  return (
    <Panel title="Verify email">
      <VerifyEmailNotice token={token} />
    </Panel>
  );
}
