import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = "/" } = await searchParams;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-start justify-center px-4 py-12 sm:px-6 sm:py-16"><LoginForm returnTo={safeReturnTo} /></main>;
}
