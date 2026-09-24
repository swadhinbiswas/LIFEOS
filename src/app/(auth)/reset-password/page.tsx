import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/tui/panel";

import { ResetPasswordForm } from "../_components/reset-password-form";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const t = await getTranslations("Auth");
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  if (!token) {
    // Real failure state: the link is malformed or was opened without its query string.
    return (
      <Panel title={t("resetPanel")} titleAs="h1">
        <div className="flex flex-col gap-3 text-xs">
          <p role="alert" className="text-destructive">
            {t("resetMissingToken")}
          </p>
          <p className="text-muted-foreground">{t("resetMissingHint")}</p>
          <Button type="button" variant="outline" asChild>
            <Link href="/forgot-password">{t("requestNewLink")}</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title={t("setNewPassword")} titleAs="h1">
      <ResetPasswordForm token={token} />
    </Panel>
  );
}
