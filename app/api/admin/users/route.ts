// Design Ref: §5 API 설계 — CRUD /users (ADMIN 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { createUser, listUsers } from "@/lib/data/store";
import { hashPassword } from "@/lib/auth/password";
import type { UserRole } from "@/types";

const VALID_ROLES: UserRole[] = ["MEMBER", "APPROVER", "ADMIN"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });
  return NextResponse.json(await listUsers());
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const departmentId = typeof body?.departmentId === "string" ? body.departmentId : "";
  const position = typeof body?.position === "string" ? body.position : "";
  const hireDate = typeof body?.hireDate === "string" ? body.hireDate : "";
  const role: UserRole = VALID_ROLES.includes(body?.role) ? body.role : "MEMBER";
  const tempPassword = typeof body?.tempPassword === "string" && body.tempPassword.length >= 8 ? body.tempPassword : null;

  if (!name || !username || !departmentId || !hireDate || !tempPassword) {
    return NextResponse.json(
      { error: "이름·아이디·부서·입사일과 8자 이상의 임시 비밀번호가 필요합니다." },
      { status: 400 }
    );
  }

  const created = await createUser(
    { name, username, departmentId, position, hireDate, role, employmentStatus: "ACTIVE", resignedAt: null },
    hashPassword(tempPassword)
  );
  return NextResponse.json(created, { status: 201 });
}
