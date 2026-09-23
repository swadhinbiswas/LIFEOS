import { Panel } from "@/components/tui/panel";
import { hasGithub, hasGoogle } from "@/env";

import { SignUpForm } from "../_components/sign-up-form";
import { SocialButtons, type SocialProvider } from "../_components/social-buttons";

export default function SignUpPage() {
  const socials: SocialProvider[] = [
    ...(hasGithub ? (["github"] as const) : []),
    ...(hasGoogle ? (["google"] as const) : []),
  ];

  return (
    <Panel title="Create account">
      <SignUpForm />
      <SocialButtons providers={socials} next="/settings" />
    </Panel>
  );
}
