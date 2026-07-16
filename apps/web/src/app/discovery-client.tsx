"use client";

import { Box, ChevronLeft, ChevronRight, Database, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { EmptyState, ErrorState, LoadingState } from "@/components/feedback";
import { RepositoryCard } from "@/components/repository-card";
import { repositoriesApi } from "@/lib/api";
import type { PaginatedRepositories, RepoType } from "@/lib/types";

type DiscoveryFilters = {
  q: string;
  repoType: RepoType | "";
  tag: string;
  page: number;
};

const pageSize = 20;

export function DiscoveryClient({ initialFilters }: { initialFilters: DiscoveryFilters }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [query, setQuery] = useState(initialFilters.q);
  const [tag, setTag] = useState(initialFilters.tag);
  const [result, setResult] = useState<PaginatedRepositories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    repositoriesApi
      .list(
        {
          q: initialFilters.q || undefined,
          repo_type: initialFilters.repoType || undefined,
          tag: initialFilters.tag || undefined,
          page: initialFilters.page,
          page_size: pageSize,
        },
        controller.signal,
      )
      .then((nextResult) => {
        setResult(nextResult);
        setError(null);
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user, reloadKey, initialFilters]);

  function navigate(next: Partial<DiscoveryFilters>) {
    const filters = { ...initialFilters, ...next };
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.repoType) params.set("repo_type", filters.repoType);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.page > 1) params.set("page", String(filters.page));
    router.push(params.size ? `/?${params.toString()}` : "/");
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: query.trim(), tag: tag.trim().toLowerCase(), page: 1 });
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1;
  const hasFilters = Boolean(initialFilters.q || initialFilters.repoType || initialFilters.tag);

  return (
    <main>
      <section className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#8a5b00]">
                {initialFilters.repoType === "dataset" ? <Database aria-hidden="true" size={17} /> : <Box aria-hidden="true" size={17} />}
                仓库发现
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {initialFilters.repoType === "model" ? "发现模型" : initialFilters.repoType === "dataset" ? "发现数据集" : "发现模型与数据集"}
              </h1>
            </div>
          </div>

          <form className="mt-6 grid max-w-4xl gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]" onSubmit={handleSearch}>
            <label className="relative min-w-0">
              <span className="sr-only">搜索仓库</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" size={19} />
              <input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white pl-10 pr-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、简介或标签" type="search" value={query} />
            </label>
            <label className="relative min-w-0">
              <span className="sr-only">标签筛选</span>
              <SlidersHorizontal aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]" size={18} />
              <input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white pl-10 pr-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" onChange={(event) => setTag(event.target.value)} placeholder="标签，例如 nlp" value={tag} />
            </label>
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#202124] px-5 font-medium text-white transition hover:bg-[#3c4043]" type="submit">
              <Search aria-hidden="true" size={17} />
              搜索
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="仓库类型筛选">
            {([
              ["", "全部"],
              ["model", "模型"],
              ["dataset", "数据集"],
            ] as const).map(([value, label]) => (
              <button className={`h-9 rounded-md px-3 text-sm font-medium ${initialFilters.repoType === value ? "bg-[#202124] text-white" : "border border-[#c9c9c9] bg-white text-[#5f6368] hover:bg-[#f2f3f5]"}`} key={value || "all"} onClick={() => navigate({ repoType: value, page: 1 })} type="button">
                {label}
              </button>
            ))}
            {hasFilters ? (
              <button className="ml-1 inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-[#5f6368] hover:bg-[#f2f3f5]" onClick={() => router.push("/")} type="button">
                <X aria-hidden="true" size={15} />
                清除筛选
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{initialFilters.q ? `“${initialFilters.q}”的搜索结果` : "最近更新"}</h2>
            <p className="mt-1 text-sm text-[#6b6f73]">{result ? `共 ${result.total} 个仓库` : "正在读取仓库"}</p>
          </div>
          {result && result.total > 0 ? <span className="text-sm text-[#6b6f73]">第 {result.page} / {totalPages} 页</span> : null}
        </div>

        {loading ? <LoadingState label="正在加载仓库..." /> : error ? <ErrorState error={error} retry={() => { setLoading(true); setReloadKey((value) => value + 1); }} /> : !result || result.items.length === 0 ? <EmptyState title="没有找到匹配的仓库" description={hasFilters ? "换一个关键词或清除筛选条件后再试。" : "登录后可以创建第一个模型或数据集仓库。"} /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {result.items.map((repository) => <RepositoryCard key={repository.id} repository={repository} />)}
          </div>
        )}

        {result && totalPages > 1 ? (
          <nav className="mt-7 flex items-center justify-center gap-3" aria-label="分页">
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c9c9c9] bg-white px-3 text-sm font-medium hover:bg-[#f2f3f5] disabled:cursor-not-allowed disabled:opacity-50" disabled={result.page <= 1} onClick={() => navigate({ page: result.page - 1 })} type="button">
              <ChevronLeft aria-hidden="true" size={17} />
              上一页
            </button>
            <span className="min-w-20 text-center text-sm text-[#5f6368]">{result.page} / {totalPages}</span>
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[#c9c9c9] bg-white px-3 text-sm font-medium hover:bg-[#f2f3f5] disabled:cursor-not-allowed disabled:opacity-50" disabled={result.page >= totalPages} onClick={() => navigate({ page: result.page + 1 })} type="button">
              下一页
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          </nav>
        ) : null}
      </section>
    </main>
  );
}
