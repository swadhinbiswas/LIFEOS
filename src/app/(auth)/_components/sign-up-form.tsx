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
import { type SignUpValues, authErrorMessage, signUpSchema } from "@/lib/auth-form";

export function SignUpForm() {
  const t = useTranslations("Auth");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { error } = await authClient.signUp.email(values);
      if (error) {
        setFormError(authErrorMessage(error));
        return;
      }
      // requireEmailVerification is on (ADR-037): no session yet, the mail carries the link.
      setSentTo(values.email);
    } catch (err) {
      setFormError(authErrorMessage(err));
    }
  });

  if (sentTo !== null) {
    return (
      <div role="status" className="flex flex-col gap-3 text-xs">
        <p className="text-success">{t("verificationSent", { email: sentTo })}</p>
        <p className="text-muted-foreground">{t("verificationSentHint")}</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/sign-in">{t("backToSignIn")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      method="post"
      action="/sign-up"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-name">{t("name")}</Label>
        <Input
          id="sign-up-name"
          type="text"
          autoComplete="name"
          placeholder={t("namePlaceholder")}
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
        {errors.name ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-email">{t("email")}</Label>
        <Input
          id="sign-up-email"
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
        <Label htmlFor="sign-up-password">{t("password")}</Label>
        <Input
          id="sign-up-password"
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

      {formError ? (
        <p role="alert" className="text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t("creating") : t("createAccount")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/sign-in" className="underline-offset-2 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
