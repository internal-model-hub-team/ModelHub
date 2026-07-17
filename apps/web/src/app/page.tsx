import { DiscoveryClient } from "@/app/discovery-client";
import type { RepoType } from "@/lib/types";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    repo_type?: string;
    tag?: string;
    category?: string;
    page?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const page = Number.parseInt(params.page ?? "1", 10);
  const repoType: RepoType | "" = params.repo_type === "model" || params.repo_type === "dataset" ? params.repo_type : "";
  const validCategories = new Set(["model-upload", "model-generator", "public", "mine", "dataset-synthetic"]);
  const category = validCategories.has(params.category ?? "") ? params.category ?? "" : "";

  return (
    <DiscoveryClient
      key={`${params.q ?? ""}|${repoType}|${category}|${params.tag ?? ""}|${page}`}
      initialFilters={{
        q: (params.q ?? "").trim(),
        repoType,
        tag: (params.tag ?? "").trim(),
        category,
        page: Number.isFinite(page) && page > 0 ? page : 1,
      }}
    />
  );
}
