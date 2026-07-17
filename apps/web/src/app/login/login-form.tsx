"use client";

import { KeyRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login({ username: username.trim(), password });
      router.replace(returnTo);
    } catch (loginError) {
      setError(loginError instanceof ApiError ? loginError.message : "登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]"><KeyRound aria-hidden="true" size={20} /></span>
        <div><h1 className="text-2xl font-semibold">登录 Model Hub</h1><p className="mt-1 text-sm text-[#6b6f73]">使用实验室内部账号登录</p></div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block"><span className="mb-2 block text-sm font-medium">用户名</span><input autoComplete="username" autoFocus className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={40} onChange={(event) => setUsername(event.target.value)} required value={username} /></label>
        <label className="block"><span className="mb-2 block text-sm font-medium">密码</span><input autoComplete="current-password" className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
        {error ? <p aria-live="polite" className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{error}</p> : null}
        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit"><LogIn aria-hidden="true" size={17} />{submitting ? "登录中..." : "登录"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-[#6b6f73]">还没有账号？ <Link className="font-medium text-[#3558a8] hover:underline" href={`/register?returnTo=${encodeURIComponent(returnTo)}`}>注册新账号</Link></p>
    </div>
  );
}
