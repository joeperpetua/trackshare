import { ShareForm } from "@/components/ShareForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Mark } from "@/components/Mark";
import { getRequestDictionary } from "@/i18n/server";
import { SUPPORTED_SERVICES } from "@/lib/sources";

interface PageProps {
  // Filled by the PWA share target (see manifest.ts) or by a link like /?url=…
  searchParams: Promise<{ url?: string; text?: string; title?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const sp = await searchParams;
  const shared = [sp.url, sp.text, sp.title].filter(Boolean).join(" ");
  const { locale, t } = await getRequestDictionary();

  return (
    <main className="page">
      <header className="brand">
        <Mark />
        <span>{t.app.name}</span>
        <LanguageSwitcher locale={locale} label={t.app.languageLabel} />
      </header>

      <ShareForm initialInput={shared} services={SUPPORTED_SERVICES} locale={locale} t={t} />

      <footer className="footer">
        <span>{t.app.name}</span>
        <span>{t.home.footerNote}</span>
      </footer>
    </main>
  );
}
