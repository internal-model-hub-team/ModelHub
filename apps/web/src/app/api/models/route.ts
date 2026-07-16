import { NextResponse } from "next/server";

type ApiError = {
  detail?: string;
};

export async function POST(request: Request) {
  const form = await request.formData();
  const payload = {
    name: String(form.get("name") ?? "").trim(),
    author: String(form.get("author") ?? "").trim(),
    task: String(form.get("task") ?? "").trim(),
    summary: String(form.get("summary") ?? "").trim(),
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${apiUrl}/api/v1/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = (await response.json()) as ApiError;
      const message =
        typeof body.detail === "string" ? body.detail : "请检查填写内容";
      return NextResponse.redirect(
        new URL(`/new?error=${encodeURIComponent(message)}`, request.url),
        303,
      );
    }

    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch {
    return NextResponse.redirect(
      new URL(
        `/new?error=${encodeURIComponent("后端 API 暂时无法连接")}`,
        request.url,
      ),
      303,
    );
  }
}
