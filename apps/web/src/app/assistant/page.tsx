"use client";

import { Bot, Check, Database, Download, Save, Search, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "@/components/auth-provider";
import { RepositoryCard } from "@/components/repository-card";
import { ApiError, assistantApi, repositoriesApi } from "@/lib/api";
import type { AssistantChatResponse, AssistantMessage, Visibility } from "@/lib/types";

type ChatMode = "search" | "generate";

const initialMessage: AssistantMessage = {
  role: "assistant",
  content: "需要什么数据？选择查找或生成，然后直接描述要求。",
};

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 100);
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<ChatMode>("search");
  const [messages, setMessages] = useState<AssistantMessage[]>([initialMessage]);
  const [prompt, setPrompt] = useState("");
  const [rowCount, setRowCount] = useState(8);
  const [result, setResult] = useState<AssistantChatResponse | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [datasetSlug, setDatasetSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedUrl, setSavedUrl] = useState("");

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: message }];
    setMessages(nextMessages);
    setPrompt("");
    setLoading(true);
    setError("");
    setSavedUrl("");
    try {
      const response = await assistantApi.chat({
        message,
        history: messages.slice(-8),
        mode,
        row_count: rowCount,
      });
      setResult(response);
      setMessages([...nextMessages, { role: "assistant", content: response.message }]);
      if (response.action === "generate") {
        setDatasetName(response.suggested_name);
        setDatasetSlug(response.suggested_slug);
        setSlugTouched(false);
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "数据助手暂时不可用");
    } finally {
      setLoading(false);
    }
  }

  function downloadPreview() {
    if (!result?.rows.length) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${datasetSlug || "synthetic-dataset"}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveDataset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !result?.rows.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const repository = await repositoriesApi.create({
        name: datasetName.trim(),
        slug: datasetSlug.trim(),
        repo_type: "dataset",
        category: "dataset-synthetic",
        visibility,
        description: `由数据助手根据对话要求合成，共 ${result.rows.length} 行。`,
        tags: ["structured-data", result.generator === "llm" ? "llm-generated" : "template-generated"],
        license: "cc-by-4.0",
        readme: `# ${datasetName.trim()}\n\n由 Model Hub 数据助手生成。\n\n字段：${result.columns.join("、")}\n`,
      });
      const file = new File(
        [JSON.stringify(result.rows, null, 2)],
        "data.json",
        { type: "application/json" },
      );
      await repositoriesApi.uploadFile("dataset", user.username, repository.slug, file, "", false);
      setSavedUrl(`/repositories/dataset/${encodeURIComponent(user.username)}/${encodeURIComponent(repository.slug)}`);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "保存数据集失败");
    } finally {
      setSaving(false);
    }
  }

  const generated = result?.action === "generate" && result.rows.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dedede] pb-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#fff3cf] text-[#6d4b00]">
            <Bot aria-hidden="true" size={21} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">数据助手</h1>
            <p className="mt-1 text-sm text-[#6b6f73]">查找平台数据集或生成结构化数据</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 rounded-md border border-[#c9c9c9] bg-white p-1 sm:inline-flex sm:w-auto" aria-label="助手模式">
          <button className={`inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-xs font-medium sm:gap-2 sm:px-3 sm:text-sm ${mode === "search" ? "bg-[#202124] text-white" : "text-[#5f6368] hover:bg-[#f2f3f5]"}`} onClick={() => setMode("search")} type="button"><Search aria-hidden="true" className="shrink-0" size={16} />查找数据集</button>
          <button className={`inline-flex h-9 items-center justify-center gap-1 whitespace-nowrap rounded px-2 text-xs font-medium sm:gap-2 sm:px-3 sm:text-sm ${mode === "generate" ? "bg-[#202124] text-white" : "text-[#5f6368] hover:bg-[#f2f3f5]"}`} onClick={() => setMode("generate")} type="button"><Sparkles aria-hidden="true" className="shrink-0" size={16} />生成数据集</button>
        </div>
      </div>

      <div className={`grid gap-8 py-7 ${generated ? "lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]" : ""}`}>
        <section className="min-w-0">
          <div className="min-h-64 space-y-4" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}`}>
                <div className={`max-w-[85%] rounded-md px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#202124] text-white" : "border border-[#dedede] bg-white text-[#3c4043]"}`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading ? <div className="w-fit rounded-md border border-[#dedede] bg-white px-4 py-3 text-sm text-[#6b6f73]">正在处理...</div> : null}
          </div>

          {result?.action === "search" && result.repositories.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {result.repositories.map((repository) => <RepositoryCard key={repository.id} repository={repository} />)}
            </div>
          ) : null}

          <form className="mt-6 border-t border-[#dedede] pt-5" onSubmit={submitPrompt}>
            <div className="mb-3 flex flex-wrap gap-2">
              {(mode === "search"
                ? ["找中文客服数据集", "搜索公开的结构化数据集"]
                : ["生成 8 行客服问答数据", "生成商品销售结构化数据"]
              ).map((example) => (
                <button className="min-h-8 max-w-full rounded-md border border-[#dedede] bg-white px-3 py-1.5 text-left text-xs leading-5 text-[#5f6368] hover:bg-[#f2f3f5]" key={example} onClick={() => setPrompt(example)} type="button">{example}</button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea className="min-h-24 min-w-0 flex-1 resize-y rounded-md border border-[#c9c9c9] bg-white px-3 py-3 outline-none focus:border-[#202124] focus:ring-2 focus:ring-[#202124]/10" maxLength={4000} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "search" ? "描述要找的数据集" : "描述字段、主题和数据要求"} required value={prompt} />
              <button className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-[#202124] text-white hover:bg-[#3c4043] disabled:opacity-50" disabled={loading || !prompt.trim()} title="发送" type="submit"><Send aria-hidden="true" size={18} /><span className="sr-only">发送</span></button>
            </div>
            {mode === "generate" ? (
              <label className="mt-3 flex w-fit items-center gap-3 text-sm text-[#5f6368]">
                生成行数
                <input className="h-9 w-20 rounded-md border border-[#c9c9c9] bg-white px-2" max={50} min={1} onChange={(event) => setRowCount(Math.min(50, Math.max(1, Number(event.target.value) || 1)))} type="number" value={rowCount} />
              </label>
            ) : null}
            {error ? <p className="mt-3 rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{error}</p> : null}
          </form>
        </section>

        {generated ? (
          <aside className="min-w-0 border-l-0 border-[#dedede] lg:border-l lg:pl-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">数据预览</h2>
                <p className="mt-1 text-xs text-[#6b6f73]">{result.rows.length} 行 · {result.generator === "llm" ? "大模型生成" : "本地模板生成"}</p>
              </div>
              <button className="inline-flex size-9 items-center justify-center rounded-md border border-[#c9c9c9] bg-white hover:bg-[#f2f3f5]" onClick={downloadPreview} title="下载 JSON" type="button"><Download aria-hidden="true" size={17} /><span className="sr-only">下载 JSON</span></button>
            </div>

            <div className="mt-4 max-h-80 overflow-auto border-y border-[#dedede] bg-white">
              <table className="w-full min-w-max text-left text-xs">
                <thead className="sticky top-0 bg-[#f5f5f5] text-[#5f6368]">
                  <tr>{result.columns.map((column) => <th className="border-b border-[#dedede] px-3 py-2 font-medium" key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>{result.rows.map((row, rowIndex) => <tr className="border-b border-[#eeeeee]" key={rowIndex}>{result.columns.map((column) => <td className="max-w-48 truncate px-3 py-2" key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody>
              </table>
            </div>

            {user ? (
              <form className="mt-6 space-y-4" onSubmit={saveDataset}>
                <label className="block"><span className="mb-1 block text-sm font-medium">数据集名称</span><input className="h-10 w-full rounded-md border border-[#c9c9c9] bg-white px-3" maxLength={100} onChange={(event) => { const nextName = event.target.value; setDatasetName(nextName); if (!slugTouched) setDatasetSlug(normalizeSlug(nextName)); }} required value={datasetName} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">仓库路径</span><input className="h-10 w-full rounded-md border border-[#c9c9c9] bg-white px-3" maxLength={100} onChange={(event) => { setSlugTouched(true); setDatasetSlug(event.target.value); }} pattern="[A-Za-z0-9_.-]{1,100}" required value={datasetSlug} /></label>
                <label className="block"><span className="mb-1 block text-sm font-medium">可见性</span><select className="h-10 w-full rounded-md border border-[#c9c9c9] bg-white px-3" onChange={(event) => setVisibility(event.target.value as Visibility)} value={visibility}><option value="public">公开</option><option value="private">私有</option></select></label>
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-[#202124] px-4 text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit"><Save aria-hidden="true" size={17} />{saving ? "保存中..." : "保存为数据集"}</button>
                {savedUrl ? <Link className="ml-3 inline-flex items-center gap-2 text-sm font-medium text-[#146c2e] hover:underline" href={savedUrl}><Check aria-hidden="true" size={16} />打开数据集</Link> : null}
              </form>
            ) : (
              <div className="mt-6 border-y border-[#dedede] py-5 text-sm text-[#5f6368]">
                <Database aria-hidden="true" className="mb-2" size={18} />
                <Link className="font-medium text-[#3558a8] hover:underline" href="/login?returnTo=/assistant">登录后保存为数据集</Link>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
