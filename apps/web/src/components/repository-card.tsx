import { Box, Database, Download, Globe2, LockKeyhole } from "lucide-react";
import Link from "next/link";

import type { Repository } from "@/lib/types";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function RepositoryCard({ repository }: { repository: Repository }) {
  const isModel = repository.repo_type === "model";
  const updatedAt = new Date(repository.updated_at);

  return (
    <article className="rounded-md border border-[#dedede] bg-white p-5 transition hover:border-[#a8a8a8]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]">
          {isModel ? <Box aria-hidden="true" size={18} /> : <Database aria-hidden="true" size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold text-[#202124]">
              <Link className="hover:underline" href={`/repositories/${repository.repo_type}/${encodeURIComponent(repository.owner.username)}/${encodeURIComponent(repository.slug)}`}>
                <span className="font-normal text-[#6b6f73]">{repository.owner.username}/</span>
                {repository.slug}
              </Link>
            </h3>
            <span className="inline-flex items-center gap-1 rounded bg-[#f2f3f5] px-2 py-1 text-xs text-[#5f6368]">
              {repository.visibility === "private" ? <LockKeyhole aria-hidden="true" size={12} /> : <Globe2 aria-hidden="true" size={12} />}
              {repository.visibility === "private" ? "私有" : "公开"}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#5f6368]">
            {repository.description || "暂时没有仓库简介"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-h-6 flex-wrap gap-2">
        <span className="rounded bg-[#fff3cf] px-2 py-1 text-xs font-medium text-[#6d4b00]">
          {isModel ? "模型" : "数据集"}
        </span>
        {repository.tags.slice(0, 5).map((tag) => (
          <span className="rounded bg-[#eef4ff] px-2 py-1 text-xs text-[#3558a8]" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4 border-t border-[#eeeeee] pt-4 text-xs text-[#6b6f73]">
        <span className="flex items-center gap-1">
          <Download aria-hidden="true" size={15} />
          {numberFormatter.format(repository.download_count)}
        </span>
        {repository.license ? <span className="truncate">{repository.license}</span> : null}
        <time className="ml-auto shrink-0" dateTime={repository.updated_at}>
          {Number.isNaN(updatedAt.getTime()) ? repository.updated_at : updatedAt.toLocaleDateString("zh-CN")} 更新
        </time>
      </div>
    </article>
  );
}
