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
import { authErrorMessage, resetPasswordSchema, type ResetPasswordValues } from "@/lib/auth-form";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { error } = await authClient.resetPassword({
        token,
        newPassword: values.password,
      });
      if (error) {
        setFormError(authErrorMessage(error));
        return;
      }
      setDone(true);
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 text-xs">
        <p className="text-success">{t("passwordUpdated")}</p>
        <p className="text-muted-foreground">{t("signInWithNewPassword")}</p>
        <Button type="button" asChild>
          <Link href="/sign-in?notice=reset">{t("continue")}</Link>
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
        <Label htmlFor="reset-password">{t("newPassword")}</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder={t("passwordPlaceholder")}
          aria-invalid={errors.password ? true : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-confirm">{t("confirmPassword")}</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          {...register("confirm")}
        />
        {errors.confirm ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.confirm.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("updating") : t("setNewPassword")}
      </Button>
    </form>
  );
}
