import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/tui/panel";

import { ResetPasswordForm } from "../_components/reset-password-form";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  if (!token) {
    // Real failure state: the link is malformed or was opened without its query string.
    return (
      <Panel title="Reset password">
        <div className="flex flex-col gap-3 text-xs">
          <p role="alert" className="text-destructive">
            this reset link is missing its token
          </p>
          <p className="text-muted-foreground">request a fresh link — each one only works once.</p>
          <Button type="button" variant="outline" asChild>
            <Link href="/forgot-password">request a new link</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Set new password">
      <ResetPasswordForm token={token} />
    </Panel>
  );
}
