import {
  ArrowLeft,
  Box,
  Download,
  FileArchive,
  HardDrive,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UploadForm } from "./upload-form";

type ModelFile = {
  id: number;
  name: string;
  size_bytes: number;
  content_type: string;
  created_at: string;
};

type ModelDetail = {
  id: number;
  name: string;
  author: string;
  task: string;
  summary: string;
  tags: string[];
  downloads: number;
  likes: number;
  updated_at: string;
  files: ModelFile[];
};

type ModelPageProps = {
  params: Promise<{ author: string; name: string }>;
};

export const dynamic = "force-dynamic";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function getModel(author: string, name: string) {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";
  const response = await fetch(
    `${apiUrl}/api/v1/models/${encodeURIComponent(author)}/${encodeURIComponent(name)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok) return null;
  return (await response.json()) as ModelDetail;
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { author, name } = await params;
  const model = await getModel(author, name);
  const publicApiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  if (!model) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-semibold">模型暂时无法加载</h1>
        <Link className="mt-4 inline-block text-[#3558a8] hover:underline" href="/">
          返回模型列表
        </Link>
      </main>
    );
  }

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

        <section className="mt-7 border-b border-[#dedede] pb-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
              <Box aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold sm:text-3xl">
                <span className="font-normal text-[#6b6f73]">{model.author}/</span>
                {model.name}
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-[#5f6368]">
                {model.summary}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
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
        </section>

        <section className="border-b border-[#dedede] py-8">
          <h2 className="text-lg font-semibold">上传模型文件</h2>
          <UploadForm
            apiUrl={publicApiUrl}
            author={model.author}
            name={model.name}
          />
        </section>

        <section className="py-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">模型文件</h2>
              <p className="mt-1 text-sm text-[#6b6f73]">
                共 {model.files.length} 个文件
              </p>
            </div>
            <span className="flex items-center gap-2 text-sm text-[#6b6f73]">
              <HardDrive aria-hidden="true" size={17} />
              {formatBytes(
                model.files.reduce((total, file) => total + file.size_bytes, 0),
              )}
            </span>
          </div>

          {model.files.length === 0 ? (
            <div className="mt-5 border-y border-[#dedede] py-12 text-center">
              <FileArchive
                aria-hidden="true"
                className="mx-auto text-[#8a8a8a]"
                size={28}
              />
              <p className="mt-3 font-medium">还没有模型文件</p>
            </div>
          ) : (
            <div className="mt-5 border-y border-[#dedede]">
              {model.files.map((file) => (
                <div
                  className="flex flex-wrap items-center gap-3 border-b border-[#eeeeee] px-2 py-4 last:border-b-0 sm:flex-nowrap"
                  key={file.id}
                >
                  <FileArchive
                    aria-hidden="true"
                    className="shrink-0 text-[#5f6368]"
                    size={19}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-all font-medium">{file.name}</p>
                    <p className="mt-1 text-xs text-[#6b6f73]">
                      {formatBytes(file.size_bytes)} · {file.created_at.slice(0, 10)}
                    </p>
                  </div>
                  <a
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-[#c9c9c9] bg-white px-3 text-sm font-medium hover:bg-[#f2f3f5]"
                    href={`${publicApiUrl}/api/v1/models/${encodeURIComponent(model.author)}/${encodeURIComponent(model.name)}/files/${encodeURIComponent(file.name)}`}
                  >
                    <Download aria-hidden="true" size={16} />
                    下载
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
