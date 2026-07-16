import { DiscoveryClient } from "@/app/discovery-client";
import type { RepoType } from "@/lib/types";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    repo_type?: string;
    tag?: string;
    page?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const repoType: RepoType | "" = params.repo_type === "model" || params.repo_type === "dataset" ? params.repo_type : "";

  return (
    <DiscoveryClient
      key={`${params.q ?? ""}|${repoType}|${params.tag ?? ""}|${page}`}
      initialFilters={{
        q: (params.q ?? "").trim(),
        repoType,
        tag: (params.tag ?? "").trim(),
        page: Number.isFinite(page) && page > 0 ? page : 1,
      }}
    />
  );
}
