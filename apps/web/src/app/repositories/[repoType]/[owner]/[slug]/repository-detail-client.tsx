"use client";

import { ArrowLeft, Box, Check, Copy, Database, Download, FileText, GitFork, Globe2, LockKeyhole, Scale, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { ErrorState, LoadingState } from "@/components/feedback";
import { repositoriesApi } from "@/lib/api";
import { categoryLabels } from "@/lib/repository-categories";
import type { Repository, RepoType } from "@/lib/types";

import { RepositoryFiles } from "./repository-files";

type DetailProps = {
  repoType: RepoType;
  owner: string;
  slug: string;
};

export function RepositoryDetailClient({ repoType, owner, slug }: DetailProps) {
  const { user, loading: authLoading } = useAuth();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    repositoriesApi
      .get(repoType, owner, slug, controller.signal)
      .then((nextRepository) => {
        setRepository(nextRepository);
        setError(null);
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [authLoading, user, reloadKey, owner, repoType, slug]);

  async function copyCloneUrl() {
    if (!repository?.clone_url) return;
    await navigator.clipboard.writeText(repository.clone_url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><LoadingState label="正在加载仓库详情..." /></main>;
  }

  if (error || !repository) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]" href={`/?repo_type=${repoType}`}>
          <ArrowLeft aria-hidden="true" size={17} />
          返回发现页
        </Link>
        <ErrorState error={error ?? new Error("仓库不存在")} retry={() => { setLoading(true); setReloadKey((value) => value + 1); }} />
      </main>
    );
  }

  const isModel = repository.repo_type === "model";
  const updatedAt = new Date(repository.updated_at);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="inline-flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]" href={`/?repo_type=${repository.repo_type}`}>
        <ArrowLeft aria-hidden="true" size={17} />
        返回{isModel ? "模型" : "数据集"}列表
      </Link>

      <section className="mt-7 border-b border-[#dedede] pb-8">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
            {isModel ? <Box aria-hidden="true" size={20} /> : <Database aria-hidden="true" size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-3xl">
                <span className="font-normal text-[#6b6f73]">{repository.owner.username}/</span>
                {repository.slug}
              </h1>
              <span className="inline-flex items-center gap-1 rounded bg-[#f2f3f5] px-2 py-1 text-xs text-[#5f6368]">
                {repository.visibility === "private" ? <LockKeyhole aria-hidden="true" size={12} /> : <Globe2 aria-hidden="true" size={12} />}
                {repository.visibility === "private" ? "私有" : "公开"}
              </span>
            </div>
            <p className="mt-3 max-w-3xl leading-7 text-[#5f6368]">{repository.description || "暂时没有仓库简介"}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded bg-[#fff3cf] px-2 py-1 text-xs font-medium text-[#6d4b00]">{categoryLabels[repository.category]}</span>
          {repository.tags.map((tag) => <Link className="rounded bg-[#eef4ff] px-2 py-1 text-xs text-[#3558a8] hover:underline" href={`/?repo_type=${repository.repo_type}&tag=${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>)}
        </div>

        <dl className="mt-6 grid gap-4 text-sm text-[#5f6368] sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2"><UserRound aria-hidden="true" size={16} /><dt className="sr-only">所有者</dt><dd>{repository.owner.display_name || repository.owner.username}</dd></div>
          <div className="flex items-center gap-2"><Download aria-hidden="true" size={16} /><dt className="sr-only">下载次数</dt><dd>{repository.download_count} 次下载</dd></div>
          <div className="flex items-center gap-2"><Scale aria-hidden="true" size={16} /><dt className="sr-only">许可证</dt><dd>{repository.license || "未指定许可证"}</dd></div>
          <div className="flex items-center gap-2"><FileText aria-hidden="true" size={16} /><dt className="sr-only">更新时间</dt><dd>{Number.isNaN(updatedAt.getTime()) ? repository.updated_at : updatedAt.toLocaleDateString("zh-CN")} 更新</dd></div>
        </dl>
      </section>

      <RepositoryFiles
        canUpload={user?.username === repository.owner.username}
        owner={repository.owner.username}
        repoType={repository.repo_type}
        slug={repository.slug}
      />

      <section className="border-b border-[#dedede] py-7">
        <div className="flex items-center gap-2">
          <GitFork aria-hidden="true" size={18} />
          <h2 className="font-semibold">克隆仓库</h2>
        </div>
        {repository.clone_url ? (
          <div className="mt-3 flex max-w-3xl items-stretch">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-l-md border border-r-0 border-[#c9c9c9] bg-white px-3 py-2.5 text-sm">{repository.clone_url}</code>
            <button className="inline-flex size-10 shrink-0 items-center justify-center rounded-r-md border border-[#c9c9c9] bg-white hover:bg-[#f2f3f5]" onClick={copyCloneUrl} title="复制克隆地址" type="button">
              {copied ? <Check aria-hidden="true" className="text-[#1e8e3e]" size={17} /> : <Copy aria-hidden="true" size={17} />}
              <span className="sr-only">复制克隆地址</span>
            </button>
          </div>
        ) : <p className="mt-3 text-sm text-[#6b6f73]">后端尚未返回 Gitea 克隆地址。</p>}
      </section>

      <section className="py-8">
        <div className="mb-4 flex items-center gap-2">
          <FileText aria-hidden="true" size={18} />
          <h2 className="text-lg font-semibold">README</h2>
        </div>
        {repository.readme ? (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-[#dedede] bg-white p-5 font-sans text-sm leading-7 text-[#3c4043]">{repository.readme}</pre>
        ) : (
          <div className="border-y border-[#dedede] py-10 text-center text-sm text-[#6b6f73]">这个仓库还没有 README。</div>
        )}
      </section>
    </main>
  );
}
