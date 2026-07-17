import { RegisterForm } from "./register-form";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = "/" } = await searchParams;
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return <main className="mx-auto flex max-w-6xl items-start justify-center px-4 py-12 sm:px-6 sm:py-16"><RegisterForm returnTo={safeReturnTo} /></main>;
}
