import type { MetadataRoute } from "next";

/**
 * Manifesto PWA (Fase 7) — permite "Adicionar à tela inicial" no
 * celular, dando ao fluxo de coleta mobile a sensação de app
 * instalado. Convenção nativa do Next.js App Router (`app/manifest.ts`
 * vira `/manifest.webmanifest` automaticamente, sem rota manual).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trilheo",
    short_name: "Trilheo",
    description: "Workspace de inovação, projetos e coleta de dados em campo.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait",
    icons: [],
  };
}
