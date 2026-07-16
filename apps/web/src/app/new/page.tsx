import { ArrowLeft, Box, Save, Sparkles } from "lucide-react";
import Link from "next/link";

type NewModelPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewModelPage({ searchParams }: NewModelPageProps) {
  const { error = "" } = await searchParams;

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#202124]">
      <header className="border-b border-[#dedede] bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" href="/">
            <span className="flex size-9 items-center justify-center rounded-md bg-[#ffbd2e] text-[#1f1f1f]">
              <Sparkles aria-hidden="true" size={19} strokeWidth={2.2} />
            </span>
            <span>Model Hub</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          className="inline-flex items-center gap-2 text-sm text-[#5f6368] hover:text-[#202124]"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={17} />
          返回模型列表
        </Link>

        <div className="mt-7 max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
              <Box aria-hidden="true" size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">创建模型</h1>
              <p className="mt-1 text-sm text-[#6b6f73]">填写模型仓库的基础信息</p>
            </div>
          </div>

          <form
            action="/api/models"
            className="mt-8 space-y-6"
            method="post"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">作者</span>
                <input
                  autoComplete="username"
                  className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                  maxLength={40}
                  minLength={2}
                  name="author"
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                  placeholder="demo-team"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">模型名称</span>
                <input
                  className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                  maxLength={64}
                  minLength={2}
                  name="name"
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]*"
                  placeholder="Chinese-Reranker-Small"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">任务类型</span>
              <select
                className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                defaultValue="文本生成"
                name="task"
                required
              >
                <option>文本生成</option>
                <option>文本排序</option>
                <option>特征提取</option>
                <option>图像转文字</option>
                <option>图像分类</option>
                <option>语音识别</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">简介</span>
              <textarea
                className="min-h-28 w-full resize-y rounded-md border border-[#c9c9c9] bg-white px-3 py-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                maxLength={500}
                minLength={5}
                name="summary"
                placeholder="一句话说明模型的用途"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium">标签</span>
              <input
                className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none transition focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10"
                name="tags"
                placeholder="中文, Reranker, 轻量"
              />
            </label>

            {error ? (
              <p
                aria-live="polite"
                className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-[#dedede] pt-6">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white transition hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                <Save aria-hidden="true" size={17} />
                创建模型
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-[#5f6368] hover:bg-[#eeeeee]"
                href="/"
              >
                取消
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
