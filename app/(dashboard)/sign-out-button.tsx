"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/client";

export function SignOutButton() {
  const t = useTranslations();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {t("nav.signOut")}
    </Button>
  );
}
