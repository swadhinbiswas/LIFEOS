import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";

import { VerifyEmailNotice } from "../_components/verify-email-notice";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const t = await getTranslations("Auth");
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  // The client notice consumes the token once on mount (StrictMode-safe ref guard);
  // verifying during render would burn the single-use token twice in development.
  return (
    <Panel title={t("verifyPanel")} titleAs="h1">
      <VerifyEmailNotice token={token} />
    </Panel>
  );
}
