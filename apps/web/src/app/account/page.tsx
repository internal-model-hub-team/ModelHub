"use client";

import { Check, Copy, KeyRound, LockKeyhole, Save, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { ErrorState, LoadingState } from "@/components/feedback";
import { ApiError, authApi, tokensApi } from "@/lib/api";
import type { ApiTokenCreated, ApiTokenSummary, User } from "@/lib/types";

export default function AccountPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState<unknown>(null);
  const [tokenName, setTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [createdToken, setCreatedToken] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    if (!user) return;
    setTokensLoading(true);
    setTokensError(null);
    try {
      setTokens(await tokensApi.list());
    } catch (error) {
      setTokensError(error);
    } finally {
      setTokensLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    tokensApi
      .list()
      .then((nextTokens) => {
        if (!cancelled) {
          setTokens(nextTokens);
          setTokensError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setTokensError(error);
      })
      .finally(() => {
        if (!cancelled) setTokensLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><LoadingState label="正在读取个人信息..." /></main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <LockKeyhole aria-hidden="true" className="mx-auto text-[#8a8a8a]" size={32} />
        <h1 className="mt-4 text-2xl font-semibold">请先登录</h1>
        <p className="mt-2 text-[#6b6f73]">登录后可以修改个人资料和管理 API Token。</p>
        <Link className="mt-5 inline-flex h-10 items-center rounded-md bg-[#202124] px-4 text-sm font-medium text-white hover:bg-[#3c4043]" href="/login?returnTo=/account">前往登录</Link>
      </main>
    );
  }

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingToken(true);
    setTokensError(null);
    setCreatedToken(null);
    try {
      const nextToken = await tokensApi.create(tokenName.trim());
      setCreatedToken(nextToken);
      setTokenName("");
      await loadTokens();
    } catch (error) {
      setTokensError(error);
    } finally {
      setCreatingToken(false);
    }
  }

  async function removeToken(token: ApiTokenSummary) {
    if (!window.confirm(`确定删除 API Token“${token.name}”吗？`)) return;
    try {
      await tokensApi.remove(token.id);
      setTokens((current) => current.filter((item) => item.id !== token.id));
    } catch (error) {
      setTokensError(error);
    }
  }

  async function copyToken() {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center gap-3 border-b border-[#dedede] pb-7">
        <span className="flex size-11 items-center justify-center rounded-md bg-[#f2f3f5] text-[#4b5563]"><UserRound aria-hidden="true" size={21} /></span>
        <div className="min-w-0"><h1 className="truncate text-2xl font-semibold">{user.display_name || user.username}</h1><p className="mt-1 text-sm text-[#6b6f73]">@{user.username} · {user.email}</p></div>
      </div>

      <section className="grid gap-8 border-b border-[#dedede] py-8 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div><h2 className="text-lg font-semibold">个人资料</h2><p className="mt-1 text-sm leading-6 text-[#6b6f73]">登录后显示在站内的基础信息。</p></div>
        <ProfileForm refreshUser={refreshUser} user={user} />
      </section>

      <section className="grid gap-8 py-8 md:grid-cols-[14rem_minmax(0,1fr)]" id="tokens">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound aria-hidden="true" size={19} />API Token</h2><p className="mt-1 text-sm leading-6 text-[#6b6f73]">供脚本或命令行访问需要登录的接口。</p></div>
        <div className="min-w-0 max-w-2xl">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={createToken}>
            <label className="min-w-0 flex-1"><span className="sr-only">Token 名称</span><input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100} minLength={1} onChange={(event) => setTokenName(event.target.value)} placeholder="例如：训练服务器" required value={tokenName} /></label>
            <button className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#202124] px-4 text-sm font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={creatingToken} type="submit"><KeyRound aria-hidden="true" size={16} />{creatingToken ? "创建中..." : "创建 Token"}</button>
          </form>

          {createdToken ? (
            <div className="mt-4 rounded-md border border-[#e6c86e] bg-[#fffbeb] p-4">
              <p className="font-medium text-[#6d4b00]">请现在保存这个 Token</p>
              <p className="mt-1 text-sm text-[#6b520f]">关闭后不会再次显示完整内容。</p>
              <div className="mt-3 flex items-stretch"><code className="min-w-0 flex-1 overflow-x-auto rounded-l-md border border-r-0 border-[#d8bd6d] bg-white px-3 py-2.5 text-sm">{createdToken.token}</code><button className="inline-flex size-10 shrink-0 items-center justify-center rounded-r-md border border-[#d8bd6d] bg-white hover:bg-[#fff8d8]" onClick={copyToken} title="复制 Token" type="button">{copied ? <Check aria-hidden="true" className="text-[#1e8e3e]" size={17} /> : <Copy aria-hidden="true" size={17} />}<span className="sr-only">复制 Token</span></button></div>
            </div>
          ) : null}

          {tokensError ? <div className="mt-5"><ErrorState error={tokensError} retry={loadTokens} /></div> : null}
          {tokensLoading ? <LoadingState label="正在加载 Token..." /> : !tokensError && tokens.length === 0 ? <p className="mt-6 border-y border-[#dedede] py-8 text-center text-sm text-[#6b6f73]">还没有 API Token。</p> : !tokensError ? (
            <div className="mt-6 border-y border-[#dedede]">
              {tokens.map((token) => (
                <div className="flex items-center gap-3 border-b border-[#eeeeee] py-4 last:border-b-0" key={token.id}>
                  <KeyRound aria-hidden="true" className="shrink-0 text-[#5f6368]" size={18} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{token.name}</p><p className="mt-1 text-xs text-[#6b6f73]">{token.prefix}... · {token.last_used_at ? `${new Date(token.last_used_at).toLocaleString("zh-CN")} 使用` : "尚未使用"}</p></div>
                  <button className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[#a50e0e] hover:bg-[#fff1f0]" onClick={() => removeToken(token)} title="删除 Token" type="button"><Trash2 aria-hidden="true" size={17} /><span className="sr-only">删除 {token.name}</span></button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ProfileForm({ user, refreshUser }: { user: User; refreshUser: () => Promise<User | null> }) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await authApi.updateMe({ display_name: displayName.trim(), bio: bio.trim() });
      await refreshUser();
      setMessage("个人资料已保存");
    } catch (updateError) {
      setError(updateError instanceof ApiError ? updateError.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="max-w-2xl space-y-5" onSubmit={updateProfile}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block"><span className="mb-2 block text-sm font-medium">用户名</span><input className="h-11 w-full rounded-md border border-[#dedede] bg-[#f5f5f5] px-3 text-[#6b6f73]" disabled value={user.username} /></label>
        <label className="block"><span className="mb-2 block text-sm font-medium">显示名称</span><input className="h-11 w-full rounded-md border border-[#c9c9c9] bg-white px-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={100} onChange={(event) => setDisplayName(event.target.value)} value={displayName} /></label>
      </div>
      <label className="block"><span className="mb-2 block text-sm font-medium">个人简介</span><textarea className="min-h-28 w-full resize-y rounded-md border border-[#c9c9c9] bg-white px-3 py-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={2000} onChange={(event) => setBio(event.target.value)} placeholder="介绍你的研究方向" value={bio} /></label>
      {error ? <p className="rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{error}</p> : null}
      {message ? <p className="rounded-md border border-[#a8dab5] bg-[#f3fbf5] px-4 py-3 text-sm text-[#146c2e]">{message}</p> : null}
      <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#202124] px-4 text-sm font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={saving} type="submit"><Save aria-hidden="true" size={17} />{saving ? "保存中..." : "保存资料"}</button>
    </form>
  );
}
