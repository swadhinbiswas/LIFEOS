import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { hasGithub, hasGoogle } from "@/env";

import { SignUpForm } from "../_components/sign-up-form";
import { SocialButtons, type SocialProvider } from "../_components/social-buttons";

export default async function SignUpPage() {
  const t = await getTranslations("Auth");
  const socials: SocialProvider[] = [
    ...(hasGithub ? (["github"] as const) : []),
    ...(hasGoogle ? (["google"] as const) : []),
  ];

  return (
    <Panel title={t("createAccount")} titleAs="h1">
      <SignUpForm />
      <SocialButtons providers={socials} next="/settings" />
    </Panel>
  );
}
