"use client";

import { ArrowUp, Database, Download, File, Folder, HardDrive, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/feedback";
import { ApiError, repositoriesApi } from "@/lib/api";
import type { RepositoryFile, RepoType } from "@/lib/types";

type RepositoryFilesProps = {
  repoType: RepoType;
  owner: string;
  slug: string;
  canUpload: boolean;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function RepositoryFiles({ repoType, owner, slug, canUpload }: RepositoryFilesProps) {
  const [directory, setDirectory] = useState("");
  const [files, setFiles] = useState<RepositoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [useLfs, setUseLfs] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    repositoriesApi
      .listFiles(repoType, owner, slug, directory, controller.signal)
      .then((result) => {
        setFiles(result.items);
        setError(null);
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [directory, owner, reloadKey, repoType, slug]);

  function openDirectory(path: string) {
    setLoading(true);
    setDirectory(path);
  }

  function goUp() {
    const parts = directory.split("/").filter(Boolean);
    parts.pop();
    openDirectory(parts.join("/"));
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    try {
      const result = await repositoriesApi.uploadFile(repoType, owner, slug, file, directory, useLfs);
      setUploadMessage(`${result.name} 上传成功${result.is_lfs ? " · Git LFS" : ""}`);
      if (fileInput.current) fileInput.current.value = "";
      setReloadKey((value) => value + 1);
    } catch (uploadFailure) {
      setUploadError(uploadFailure instanceof ApiError ? uploadFailure.message : "文件上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(file: RepositoryFile) {
    try {
      setUploadError("");
      const blob = await repositoriesApi.downloadFile(repoType, owner, slug, file.path);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setUploadError(downloadError instanceof ApiError ? downloadError.message : "文件下载失败");
    }
  }

  return (
    <section className="border-b border-[#dedede] py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database aria-hidden="true" size={18} />
            <h2 className="text-lg font-semibold">仓库文件</h2>
          </div>
          <p className="mt-1 break-all text-sm text-[#6b6f73]">/{directory}</p>
        </div>
        {directory ? (
          <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#c9c9c9] bg-white px-3 text-sm font-medium hover:bg-[#f2f3f5]" onClick={goUp} type="button">
            <ArrowUp aria-hidden="true" size={16} />
            上一级
          </button>
        ) : null}
      </div>

      {canUpload ? (
        <form className="mt-5 border-y border-[#dedede] py-4" onSubmit={uploadFile}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="min-w-0 flex-1">
              <span className="sr-only">选择上传文件</span>
              <input className="block h-11 w-full rounded-md border border-[#c9c9c9] bg-white text-sm text-[#5f6368] file:mr-3 file:h-full file:border-0 file:border-r file:border-[#dedede] file:bg-[#f2f3f5] file:px-4 file:text-sm file:font-medium file:text-[#202124]" disabled={uploading} name="file" ref={fileInput} required type="file" />
            </label>
            <label className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-[#c9c9c9] bg-white px-3 text-sm">
              <input checked={useLfs} onChange={(event) => setUseLfs(event.target.checked)} type="checkbox" />
              Git LFS
            </label>
            <button className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60" disabled={uploading} type="submit">
              <Upload aria-hidden="true" size={17} />
              {uploading ? "上传中..." : "上传"}
            </button>
          </div>
          {uploadError ? <p className="mt-3 rounded-md border border-[#f1b5b1] bg-[#fff7f6] px-4 py-3 text-sm text-[#a50e0e]">{uploadError}</p> : null}
          {uploadMessage ? <p className="mt-3 rounded-md border border-[#a8dab5] bg-[#f3fbf5] px-4 py-3 text-sm text-[#146c2e]">{uploadMessage}</p> : null}
        </form>
      ) : uploadError ? <p className="mt-4 text-sm text-[#a50e0e]">{uploadError}</p> : null}

      {loading ? <LoadingState label="正在加载仓库文件..." /> : error ? <div className="mt-5"><ErrorState error={error} retry={() => { setLoading(true); setReloadKey((value) => value + 1); }} /></div> : files.length === 0 ? <div className="mt-5"><EmptyState title="这个目录还没有文件" /></div> : (
        <div className="mt-5 border-y border-[#dedede]">
          {files.map((file) => (
            <div className="flex min-h-14 items-center gap-3 border-b border-[#eeeeee] px-2 py-3 last:border-b-0" key={file.path}>
              {file.type === "dir" ? <Folder aria-hidden="true" className="shrink-0 text-[#8a5b00]" size={19} /> : file.is_lfs ? <HardDrive aria-hidden="true" className="shrink-0 text-[#3558a8]" size={19} /> : <File aria-hidden="true" className="shrink-0 text-[#5f6368]" size={19} />}
              <div className="min-w-0 flex-1">
                {file.type === "dir" ? <button className="max-w-full truncate text-left font-medium text-[#3558a8] hover:underline" onClick={() => openDirectory(file.path)} type="button">{file.name}</button> : <p className="truncate font-medium">{file.name}</p>}
                {file.type !== "dir" ? <p className="mt-1 text-xs text-[#6b6f73]">{formatBytes(file.size)}{file.is_lfs ? " · LFS" : ""}</p> : null}
              </div>
              {file.type === "file" ? (
                <button className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-[#c9c9c9] bg-white hover:bg-[#f2f3f5]" onClick={() => downloadFile(file)} title={`下载 ${file.name}`} type="button">
                  <Download aria-hidden="true" size={16} />
                  <span className="sr-only">下载 {file.name}</span>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
