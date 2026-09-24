import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";

import { ForgotPasswordForm } from "../_components/forgot-password-form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <Panel title={t("resetPanel")} titleAs="h1">
      <ForgotPasswordForm />
    </Panel>
  );
}
