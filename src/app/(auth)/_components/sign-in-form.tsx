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
import { type SignInValues, authErrorMessage, safeNext, signInSchema } from "@/lib/auth-form";

export function SignInForm({ next, notice }: { next?: string | null; notice?: string | null }) {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { error } = await authClient.signIn.email(values);
      if (error) {
        setFormError(authErrorMessage(error));
        return;
      }
      window.location.assign(safeNext(next));
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  return (
    <form
      method="post"
      action="/sign-in"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      {notice === "reset" ? (
        <p role="status" className="text-xs text-success">
          {t("resetNotice")}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-in-email">{t("email")}</Label>
        <Input
          id="sign-in-email"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-in-password">{t("password")}</Label>
        <Input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register("password")}
        />
        {errors.password ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("signingIn") : t("signIn")}
      </Button>

      <div className="flex items-center justify-between text-xs">
        <Link
          href="/forgot-password"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          {t("forgotPasswordLink")}
        </Link>
        <Link href="/sign-up" className="text-muted-foreground underline-offset-2 hover:underline">
          {t("createAccount")}
        </Link>
      </div>
    </form>
  );
}
