import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Defesa em profundidade multi-tenant/autenticação: bloqueia qualquer
 * requisição sem sessão para fora de /login, /signup e /api/auth
 * antes mesmo de chegar num Server Component. `app/(dashboard)/layout.tsx`
 * repete a checagem de sessão (não confia só no middleware), e
 * `[orgSlug]/layout.tsx` confere que a org da URL bate com a da
 * sessão (evita um usuário autenticado abrir a rota de outra org).
 */
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: [
    "/((?!login|signup|public|api/public|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
