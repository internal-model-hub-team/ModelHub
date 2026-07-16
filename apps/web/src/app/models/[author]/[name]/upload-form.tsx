"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type UploadFormProps = {
  apiUrl: string;
  author: string;
  name: string;
};

type ApiError = {
  detail?: string;
};

const acceptedFileTypes = [
  ".safetensors",
  ".gguf",
  ".onnx",
  ".bin",
  ".pt",
  ".pth",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".py",
  ".csv",
  ".zip",
  ".tar",
  ".gz",
].join(",");

export function UploadForm({ apiUrl, author, name }: UploadFormProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setUploading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `${apiUrl}/api/v1/models/${encodeURIComponent(author)}/${encodeURIComponent(name)}/files`,
        { method: "POST", body: data },
      );
      if (!response.ok) {
        const body = (await response.json()) as ApiError;
        throw new Error(
          typeof body.detail === "string" ? body.detail : "文件上传失败",
        );
      }

      form.reset();
      setMessage("文件上传成功");
      router.refresh();
    } catch (uploadError) {
      setIsError(true);
      setMessage(
        uploadError instanceof Error ? uploadError.message : "文件上传失败",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form className="mt-4" onSubmit={handleUpload}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">选择模型文件</span>
          <input
            accept={acceptedFileTypes}
            className="block h-11 w-full rounded-md border border-[#c9c9c9] bg-white text-sm text-[#5f6368] file:mr-3 file:h-full file:border-0 file:border-r file:border-[#dedede] file:bg-[#f2f3f5] file:px-4 file:text-sm file:font-medium file:text-[#202124]"
            disabled={!ready || uploading}
            name="file"
            required
            type="file"
          />
        </label>
        <button
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#202124] px-4 font-medium text-white transition hover:bg-[#3c4043] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!ready || uploading}
          type="submit"
        >
          <Upload aria-hidden="true" size={17} />
          {uploading ? "上传中..." : "上传文件"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#6b6f73]">单个文件最大 500MB</p>
      {message ? (
        <p
          aria-live="polite"
          className={`mt-3 rounded-md border px-4 py-3 text-sm ${
            isError
              ? "border-[#f1b5b1] bg-[#fff7f6] text-[#a50e0e]"
              : "border-[#a8dab5] bg-[#f3fbf5] text-[#146c2e]"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
