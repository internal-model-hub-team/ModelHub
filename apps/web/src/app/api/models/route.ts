import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { detail: "旧创建入口已停用，请登录后使用 /new 页面创建仓库" },
    { status: 410 },
  );
}
