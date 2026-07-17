"use client";

import { ArrowLeft, Box, Database, LockKeyhole, Save, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { LoadingState } from "@/components/feedback";
import { ApiError, repositoriesApi } from "@/lib/api";
import { categoryOptions, defaultCategory } from "@/lib/repository-categories";
import type { RepoType, RepositoryCategory, Visibility } from "@/lib/types";

function makeSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_.-]/g, "").slice(0, 100);
}

export default function NewRepositoryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [repoType, setRepoType] = useState<RepoType>("model");
  const [category, setCategory] = useState<RepositoryCategory>("model-upload");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [license, setLicense] = useState("apache-2.0");
  const [readme, setReadme] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (authLoading) return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><LoadingState label="正在检查登录状态..." /></main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <LockKeyhole aria-hidden="true" className="mx-auto text-[#8a8a8a]" size={32} />
        <h1 className="mt-4 text-2xl font-semibold">登录后才能创建仓库</h1>
        <p className="mt-2 text-[#6b6f73]">仓库会自动归属到你的用户名下。</p>
        <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-[#202124] px-4 text-sm font-medium text-white hover:bg-[#3c4043]" href="/login?returnTo=/new">前往登录</Link>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const repository = await repositoriesApi.create({
        name: name.trim(),
        slug: slug.trim(),
        repo_type: repoType,
        category,
        visibility,
        description: description.trim(),
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        license: license.trim(),
        readme: readme.trim(),
      });
      router.push(`/repositories/${repository.repo_type}/${encodeURIComponent(repository.owner.username)}/${encodeURIComponent(repository.slug)}`);
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "创建失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link className="inline-flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]" href="/">
        <ArrowLeft aria-hidden="true" size={17} />
        返回发现页
      </Link>

      <div className="mt-7 max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
            {repoType === "model" ? <Box aria-hidden="true" size={20} /> : <Database aria-hidden="true" size={20} />}
          </span>
          <div>
            <h1 className="text-2xl font-semibold">创建仓库</h1>
            <p className="mt-1 text-sm text-[#6b6f73]">仓库所有者：{user.username}</p>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">仓库类型</legend>
            <div className="inline-flex rounded-md border border-[#c9c9c9] bg-white p-1">
              <button className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-medium ${repoType === "model" ? "bg-[#202124] text-white" : "text-[#5f6368] hover:bg-[#f2f3f5]"}`} onClick={() => { setRepoType("model"); setCategory(defaultCategory("model")); }} type="button"><Box aria-hidden="true" size={16} />模型</button>
              <button className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-medium ${repoType === "dataset" ? "bg-[#202124] text-white" : "text-[#5f6368] hover:bg-[#f2f3f5]"}`} onClick={() => { setRepoType("dataset"); setCategory(defaultCategory("dataset")); }} type="button"><Database aria-hidden="true" size={16} />数据集</button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">用途分类</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {categoryOptions(repoType).map((option) => (
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-4 ${category === option.value ? "border-[#202124] bg-white" : "border-[#dedede]"}`} key={option.value}>
                  <input checked={category === option.value} name="category" onChange={() => setCategory(option.value)} type="radio" value={option.value} />
                  {option.value.endsWith("upload") ? <Upload aria-hidden="true" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">显示名称</span>
              <input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100} minLength={1} onChange={(event) => { const nextName = event.target.value; setName(nextName); if (!slugTouched) setSlug(makeSlug(nextName)); }} placeholder="Tiny BERT" required value={name} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">仓库路径</span>
              <div className="flex h-11 overflow-hidden rounded-md border border-[#c9c9c9] bg-white focus-within:border-[#202124] focus-within:ring-2 focus-within:ring-[#202124]/10">
                <span className="flex shrink-0 items-center border-r border-[#dedede] bg-[#f5f5f5] px-3 text-sm text-[#6b6f73]">{user.username}/</span>
                <input className="min-w-0 flex-1 px-3 outline-none" maxLength={100} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} pattern="[A-Za-z0-9_.-]{1,100}" placeholder="tiny-bert" required value={slug} />
              </div>
              <span className="mt-1 block text-xs text-[#6b6f73]">只能使用英文字母、数字、点、横线和下划线</span>
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">可见性</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {([{"value":"public","title":"公开仓库","text":"实验室成员可以发现并查看"},{"value":"private","title":"私有仓库","text":"只有有权限的用户可以查看"}] as const).map((option) => (
                <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${visibility === option.value ? "border-[#202124] bg-white" : "border-[#dedede]"}`} key={option.value}>
                  <input checked={visibility === option.value} className="mt-1" name="visibility" onChange={() => setVisibility(option.value)} type="radio" value={option.value} />
                  <span><span className="block text-sm font-medium">{option.title}</span><span className="mt-1 block text-xs text-[#6b6f73]">{option.text}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-2 block text-sm font-medium">简介</span>
            <textarea className="min-h-28 w-full resize-y rounded-md border border-[#c9c9c9] bg-white px-3 py-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={5000} onChange={(event) => setDescription(event.target.value)} placeholder="说明这个仓库的用途" value={description} />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium">标签</span><input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" onChange={(event) => setTags(event.target.value)} placeholder="nlp, bert, chinese" value={tags} /><span className="mt-1 block text-xs text-[#6b6f73]">多个标签使用英文逗号分开</span></label>
            <label className="block"><span className="mb-2 block text-sm font-medium">许可证</span><input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100} onChange={(event) => setLicense(event.target.value)} placeholder="apache-2.0" value={license} /></label>
          </div>

          <label className="block"><span className="mb-2 block text-sm font-medium">README</span><textarea className="min-h-48 w-full resize-y rounded-md border border-[#c9c9c9] bg-white px-3 py-3 font-mono text-sm outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100000} onChange={(event) => setReadme(event.target.value)} placeholder={`# ${name || "仓库名称"}\n\n介绍如何使用这个仓库。`} value={readme} /></label>

          {error ? <p aria-live="polite" className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-[#dedede] pt-6">
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit"><Save aria-hidden="true" size={17} />{submitting ? "创建中..." : `创建${repoType === "model" ? "模型" : "数据集"}`}</button>
            <Link className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-[#5f6368] hover:bg-[#eeeeee]" href="/">取消</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
