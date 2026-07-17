import { redirect } from "next/navigation";

export default async function LegacyDatasetPage({ params }: { params: Promise<{ author: string; name: string }> }) {
  const { author, name } = await params;
  redirect(`/repositories/dataset/${encodeURIComponent(author)}/${encodeURIComponent(name)}`);
}
