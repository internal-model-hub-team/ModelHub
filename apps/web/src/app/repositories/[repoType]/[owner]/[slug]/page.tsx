import { notFound } from "next/navigation";

import { RepositoryDetailClient } from "./repository-detail-client";
import type { RepoType } from "@/lib/types";

type RepositoryPageProps = {
  params: Promise<{ repoType: string; owner: string; slug: string }>;
};

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { repoType, owner, slug } = await params;
  if (repoType !== "model" && repoType !== "dataset") notFound();

  return <RepositoryDetailClient owner={decodeURIComponent(owner)} repoType={repoType as RepoType} slug={decodeURIComponent(slug)} />;
}
