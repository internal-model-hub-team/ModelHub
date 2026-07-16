import { redirect } from "next/navigation";

export default async function LegacyModelPage({ params }: { params: Promise<{ author: string; name: string }> }) {
  const { author, name } = await params;
  redirect(`/repositories/model/${encodeURIComponent(author)}/${encodeURIComponent(name)}`);
}
