"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "@/lib/modules/auth/actions";
import { useTranslations } from "@/lib/i18n/client";

export function SignupForm() {
  const router = useRouter();
  const t = useTranslations();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signupAction({
      organizationName: organizationName.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    setLoading(false);
    if (!signInRes || signInRes.error) {
      router.push("/login");
      return;
    }
    router.push(`/${result.data.organizationSlug}/innovation`);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-sm">
      <h1 className="text-lg font-semibold">{t("signup.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("signup.subtitle")}</p>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="organizationName">{t("signup.organizationName")}</Label>
          <Input
            id="organizationName"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">{t("signup.yourName")}</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">{t("signup.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{t("signup.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("signup.submitting") : t("signup.submit")}
        </Button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        {t("signup.alreadyHaveAccount")}{" "}
        <Link href="/login" className="underline hover:text-foreground">
          {t("signup.signIn")}
        </Link>
      </p>
    </div>
  );
}
