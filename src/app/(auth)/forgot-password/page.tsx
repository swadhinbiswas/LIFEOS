import { Panel } from "@/components/tui/panel";

import { ForgotPasswordForm } from "../_components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <Panel title="Reset password" titleAs="h1">
      <ForgotPasswordForm />
    </Panel>
  );
}
