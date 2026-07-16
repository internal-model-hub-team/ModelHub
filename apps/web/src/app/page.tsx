import {
  Box,
  Database,
  Download,
  Heart,
  Plus,
  Search,
  Server,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

type ModelSummary = {
  id: number;
  name: string;
  author: string;
  task: string;
  summary: string;
  tags: string[];
  downloads: number;
  likes: number;
  updated_at: string;
};

type HomeProps = {
  searchParams: Promise<{ q?: string }>;
};

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

async function getModels(query: string): Promise<{
  models: ModelSummary[];
  connected: boolean;
}> {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const url = new URL("/api/v1/models", apiUrl);

  if (query) {
    url.searchParams.set("q", query);
  }

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return { models: await response.json(), connected: true };
  } catch {
    return { models: [], connected: false };
  }
}

export default async function Home({ searchParams }: HomeProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const { models, connected } = await getModels(query);
  const giteaUrl = process.env.NEXT_PUBLIC_GITEA_URL ?? "http://localhost:3001";

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#202124]">
      <header className="border-b border-[#dedede] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" href="/">
            <span className="flex size-9 items-center justify-center rounded-md bg-[#ffbd2e] text-[#1f1f1f]">
              <Sparkles aria-hidden="true" size={19} strokeWidth={2.2} />
            </span>
            <span>Model Hub</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-[#5f6368] sm:flex">
            <Link className="font-medium text-[#202124]" href="/">
              模型
            </Link>
            <a href={`${giteaUrl}/explore/repos`}>仓库</a>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link
              className="flex h-9 items-center gap-2 rounded-md bg-[#202124] px-3 text-sm font-medium text-white transition hover:bg-[#3c4043]"
              href="/new"
            >
              <Plus aria-hidden="true" size={17} />
              创建模型
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${connected ? "bg-[#1e8e3e]" : "bg-[#d93025]"}`}
                aria-hidden="true"
              />
              <span className="hidden text-sm text-[#5f6368] sm:inline">
                {connected ? "API 已连接" : "API 未连接"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#e5e5e5] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <div className="max-w-3xl">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-[#8a5b00]">
                <Box aria-hidden="true" size={17} />
                模型发现
              </p>
              <h1 className="text-3xl font-semibold sm:text-4xl">
                发现并共享 AI 模型
              </h1>
            </div>

            <form className="mt-7 flex max-w-3xl gap-2" action="/" method="get">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">搜索模型</span>
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                  size={19}
                />
                <input
                  className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white pl-10 pr-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                  defaultValue={query}
                  name="q"
                  placeholder="搜索名称、任务或标签"
                  type="search"
                />
              </label>
              <button
                className="h-11 rounded-md bg-[#202124] px-5 font-medium text-white transition hover:bg-[#3c4043]"
                type="submit"
              >
                搜索
              </button>
            </form>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {query ? `“${query}”的搜索结果` : "最近更新"}
              </h2>
              <p className="mt-1 text-sm text-[#6b6f73]">
                共 {models.length} 个模型
              </p>
            </div>
            <a
              className="flex items-center gap-2 text-sm font-medium text-[#3558a8] hover:underline"
              href={`${giteaUrl}/explore/repos`}
            >
              <Server aria-hidden="true" size={17} />
              打开 Gitea
            </a>
          </div>

          {!connected ? (
            <div className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-5">
              <p className="font-medium text-[#a50e0e]">后端 API 暂时无法连接</p>
              <p className="mt-1 text-sm text-[#6b3a38]">
                请先运行 docker compose up --build，再刷新页面。
              </p>
            </div>
          ) : models.length === 0 ? (
            <div className="border-y border-[#dedede] py-14 text-center">
              <Database
                aria-hidden="true"
                className="mx-auto text-[#8a8a8a]"
                size={28}
              />
              <p className="mt-3 font-medium">没有找到匹配的模型</p>
              <Link className="mt-2 inline-block text-sm text-[#3558a8] hover:underline" href="/">
                清除搜索条件
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {models.map((model) => (
                <article
                  className="rounded-md border border-[#dedede] bg-white p-5 transition hover:border-[#a8a8a8]"
                  key={model.id}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
                      <Box aria-hidden="true" size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold text-[#202124]">
                        <Link
                          className="hover:underline"
                          href={`/models/${encodeURIComponent(model.author)}/${encodeURIComponent(model.name)}`}
                        >
                          <span className="font-normal text-[#6b6f73]">
                            {model.author}/
                          </span>
                          {model.name}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                        {model.summary}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded bg-[#fff3cf] px-2 py-1 text-xs font-medium text-[#6d4b00]">
                      {model.task}
                    </span>
                    {model.tags.map((tag) => (
                      <span
                        className="rounded bg-[#eef4ff] px-2 py-1 text-xs text-[#3558a8]"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center gap-4 border-t border-[#eeeeee] pt-4 text-xs text-[#6b6f73]">
                    <span className="flex items-center gap-1">
                      <Download aria-hidden="true" size={15} />
                      {numberFormatter.format(model.downloads)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart aria-hidden="true" size={15} />
                      {numberFormatter.format(model.likes)}
                    </span>
                    <time className="ml-auto" dateTime={model.updated_at}>
                      {model.updated_at} 更新
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
