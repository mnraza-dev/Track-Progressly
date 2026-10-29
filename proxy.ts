import { clerkMiddleware } from "@clerk/nextjs/server";

const protectedPatterns = [
  '/dashboard',
  '/courses',
  '/continue',
  '/notes',
  '/analytics',
  '/goals',
  '/settings',
];

const authPaths = ['/login', '/signup'];

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // Redirect authenticated users away from sign-in/sign-up screens
  const onAuthPage = authPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (userId && onAuthPage) {
    return Response.redirect(new URL('/dashboard', req.url));
  }

  // Protect workspace routes
  const isProtected = protectedPatterns.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !userId) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|artwork).*)"],
};
