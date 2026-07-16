import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import Link from "next/link";

import { ApiError } from "@/lib/api";

export function LoadingState({ label = "正在加载..." }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-[#6b6f73]" role="status">
      <LoaderCircle aria-hidden="true" className="animate-spin" size={20} />
      {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-y border-[#dedede] py-14 text-center">
      <Inbox aria-hidden="true" className="mx-auto text-[#8a8a8a]" size={29} />
      <p className="mt-3 font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-lg text-sm text-[#6b6f73]">{description}</p> : null}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const status = apiError?.status;
  const title = status === 401 ? "需要登录" : status === 404 ? "内容不存在" : status === 0 ? "后端尚未连接" : status && status >= 500 ? "服务器暂时不可用" : "加载失败";
  const message = apiError?.message ?? "发生了未知错误，请稍后重试";

  return (
    <div className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-5 text-[#7d2823]" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 break-words text-sm">{message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
            {status === 401 ? <Link className="text-[#3558a8] hover:underline" href="/login">前往登录</Link> : null}
            {retry ? <button className="text-[#3558a8] hover:underline" onClick={retry} type="button">重新加载</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
