import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center sm:px-6">
      <SearchX aria-hidden="true" className="text-[#8a8a8a]" size={34} />
      <h1 className="mt-4 text-2xl font-semibold">页面不存在</h1>
      <p className="mt-2 text-[#6b6f73]">地址可能已更改，或者仓库已经被删除。</p>
      <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-[#202124] px-4 text-sm font-medium text-white hover:bg-[#3c4043]" href="/">返回发现页</Link>
    </main>
  );
}
