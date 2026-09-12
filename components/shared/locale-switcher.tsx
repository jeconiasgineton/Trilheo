"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { useLocale, useTranslations } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { setLocaleAction } from "@/lib/i18n/actions";

export function LocaleSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(locale);

  function handleChange(next: string) {
    setValue(next as typeof locale);
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <Select
      aria-label={t("locale.label")}
      className="h-8 w-auto text-xs"
      value={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </Select>
  );
}
