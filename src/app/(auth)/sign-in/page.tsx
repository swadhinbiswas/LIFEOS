import { Panel } from "@/components/tui/panel";
import { hasGithub, hasGoogle } from "@/env";

import { SignInForm } from "../_components/sign-in-form";
import { SocialButtons, type SocialProvider } from "../_components/social-buttons";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const firstString = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = firstString(params.next);
  const notice = firstString(params.notice);
  // Same condition the server config uses to register providers (ADR-023).
  const socials: SocialProvider[] = [
    ...(hasGithub ? (["github"] as const) : []),
    ...(hasGoogle ? (["google"] as const) : []),
  ];

  return (
    <Panel title="Sign in" titleAs="h1">
      <SignInForm next={next} notice={notice} />
      <SocialButtons providers={socials} next={next} />
    </Panel>
  );
}
