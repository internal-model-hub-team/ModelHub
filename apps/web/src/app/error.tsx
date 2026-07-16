"use client";

import { ErrorState } from "@/components/feedback";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><ErrorState error={error} retry={reset} /></main>;
}
