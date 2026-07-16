"use client";

import { Box, Database, KeyRound, LogIn, LogOut, Plus, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[#dedede] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <Link className="flex items-center gap-2 font-semibold" href="/">
          <span className="flex size-9 items-center justify-center rounded-md bg-[#ffbd2e] text-[#1f1f1f]">
            <Sparkles aria-hidden="true" size={19} strokeWidth={2.2} />
          </span>
          <span>Model Hub</span>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm text-[#5f6368] sm:order-none sm:w-auto">
          <Link className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 hover:bg-[#f2f3f5] hover:text-[#202124]" href="/?repo_type=model">
            <Box aria-hidden="true" size={16} />
            模型
          </Link>
          <Link className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 hover:bg-[#f2f3f5] hover:text-[#202124]" href="/?repo_type=dataset">
            <Database aria-hidden="true" size={16} />
            数据集
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link className="inline-flex h-9 items-center gap-2 rounded-md bg-[#202124] px-3 text-sm font-medium text-white hover:bg-[#3c4043]" href="/new">
            <Plus aria-hidden="true" size={16} />
            <span className="hidden sm:inline">创建仓库</span>
            <span className="sm:hidden">创建</span>
          </Link>

          {loading ? (
            <span className="h-9 w-20 animate-pulse rounded-md bg-[#eeeeee]" aria-label="正在读取登录状态" />
          ) : user ? (
            <>
              <Link className="inline-flex h-9 max-w-36 items-center gap-2 rounded-md border border-[#c9c9c9] px-3 text-sm font-medium hover:bg-[#f2f3f5]" href="/account">
                <UserRound aria-hidden="true" className="shrink-0" size={16} />
                <span className="truncate">{user.display_name || user.username}</span>
              </Link>
              <Link className="hidden size-9 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f2f3f5] sm:inline-flex" href="/account#tokens" title="API Token">
                <KeyRound aria-hidden="true" size={17} />
                <span className="sr-only">API Token</span>
              </Link>
              <button className="inline-flex size-9 items-center justify-center rounded-md text-[#5f6368] hover:bg-[#f2f3f5]" onClick={handleLogout} title="退出登录" type="button">
                <LogOut aria-hidden="true" size={17} />
                <span className="sr-only">退出登录</span>
              </button>
            </>
          ) : (
            <>
              <Link className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-[#5f6368] hover:bg-[#f2f3f5] hover:text-[#202124]" href="/login">
                <LogIn aria-hidden="true" size={16} />
                登录
              </Link>
              <Link className="hidden h-9 items-center rounded-md border border-[#c9c9c9] px-3 text-sm font-medium hover:bg-[#f2f3f5] sm:inline-flex" href="/register">
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
