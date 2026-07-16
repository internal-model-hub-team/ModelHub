"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { ApiError } from "@/lib/api";

export function RegisterForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await register({ username: username.trim(), email: email.trim(), password, display_name: displayName.trim() });
      router.replace(returnTo);
    } catch (registerError) {
      setError(registerError instanceof ApiError ? registerError.message : "注册失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]"><UserPlus aria-hidden="true" size={20} /></span>
        <div><h1 className="text-2xl font-semibold">创建账号</h1><p className="mt-1 text-sm text-[#6b6f73]">注册实验室内部 Model Hub</p></div>
      </div>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-sm font-medium">用户名</span><input autoComplete="username" autoFocus className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={40} minLength={3} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_-]{3,40}" placeholder="zhangsan" required value={username} /><span className="mt-1 block text-xs text-[#6b6f73]">3-40 位英文字母、数字、横线或下划线</span></label>
          <label className="block"><span className="mb-2 block text-sm font-medium">显示名称</span><input autoComplete="name" className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100} onChange={(event) => setDisplayName(event.target.value)} placeholder="张三" value={displayName} /></label>
        </div>
        <label className="block"><span className="mb-2 block text-sm font-medium">邮箱</span><input autoComplete="email" className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-sm font-medium">密码</span><input autoComplete="new-password" className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /><span className="mt-1 block text-xs text-[#6b6f73]">至少 8 个字符</span></label>
          <label className="block"><span className="mb-2 block text-sm font-medium">确认密码</span><input autoComplete="new-password" className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={128} minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
        </div>
        {error ? <p aria-live="polite" className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{error}</p> : null}
        <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit"><UserPlus aria-hidden="true" size={17} />{submitting ? "注册中..." : "注册并登录"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-[#6b6f73]">已经有账号？ <Link className="font-medium text-[#3558a8] hover:underline" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>直接登录</Link></p>
    </div>
  );
}
