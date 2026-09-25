"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { type ForgotPasswordValues, authErrorMessage, forgotPasswordSchema } from "@/lib/auth-form";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: values.email,
        // Better Auth's origin-checked callback hop lands on the spec §5 reset page
        // with `?token=…` (verified in better-auth password.mjs).
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setFormError(authErrorMessage(error));
        return;
      }
      setSentTo(values.email);
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  if (sentTo !== null) {
    return (
      <div role="status" className="flex flex-col gap-3 text-xs">
        <p className="text-success">{t("resetSent", { email: sentTo })}</p>
        <p className="text-muted-foreground">{t("resetSentHint")}</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="forgot-email">{t("email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          aria-invalid={errors.email ? true : undefined}
          {...register("email")}
        />
        {errors.email ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("sending") : t("sendReset")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t("remembered")}{" "}
        <Link href="/sign-in" className="underline-offset-2 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
