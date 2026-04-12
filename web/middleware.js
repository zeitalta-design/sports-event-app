import { NextResponse } from "next/server";

// middleware は現在無効化中
// 認証は AdminGuard + requireAdminApi で保護
export default function middleware() {
  return NextResponse.next();
}
