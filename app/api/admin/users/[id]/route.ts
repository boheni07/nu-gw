// Design Ref: §2.5 사용자 관리 — 정보 수정/권한 부여/퇴사 처리/삭제/비밀번호 초기화(ADMIN 전용)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { MASTER_ADMIN_EMAIL } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { deleteUser, getUserById, listUsers, resignUser, updateUser, updateUserPasswordHash } from "@/lib/data/store";

/** 재직 중인 ADMIN이 이 사용자 1명뿐인지 확인한다(마지막 관리자 계정 보호). */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const target = await getUserById(userId);
  if (!target || target.role !== "ADMIN" || target.employmentStatus === "RESIGNED") return false;
  const activeAdmins = (await listUsers()).filter((u) => u.role === "ADMIN" && u.employmentStatus !== "RESIGNED");
  return activeAdmins.length <= 1 && activeAdmins[0]?.id === userId;
}

/** module-17 — 총괄관리자(master@nubiz.kr)는 다른 관리자가 삭제·강등·퇴사 처리할 수 없다(DB 초기화 시 항상 복원되는 계정 보호). */
async function isMasterAdmin(userId: string): Promise<boolean> {
  const target = await getUserById(userId);
  return target?.email === MASTER_ADMIN_EMAIL;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(sessionUser)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });

  const { id: userId } = await params;

  // 비밀번호 초기화 — 관리자가 임시 비밀번호를 지정해 대상 계정의 비밀번호를 강제로 교체한다.
  if (body.action === "reset-password") {
    const tempPassword = typeof body.tempPassword === "string" ? body.tempPassword : "";
    if (tempPassword.length < 8) {
      return NextResponse.json({ error: "임시 비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    }
    const updated = await updateUserPasswordHash(userId, hashPassword(tempPassword));
    if (!updated) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // 퇴사 처리 — 삭제가 아닌 상태 변경(감사 추적 가능, 비기능요구 §3). 퇴사일자를 함께 받는다.
  if (body.action === "resign") {
    const resignedAt = typeof body.resignedAt === "string" && body.resignedAt ? body.resignedAt : "";
    if (!resignedAt) {
      return NextResponse.json({ error: "퇴사일자를 입력해주세요." }, { status: 400 });
    }
    if (await isMasterAdmin(userId)) {
      return NextResponse.json({ error: "총괄관리자 계정은 퇴사 처리할 수 없습니다." }, { status: 409 });
    }
    if (await isLastActiveAdmin(userId)) {
      return NextResponse.json({ error: "마지막 남은 관리자 계정은 퇴사 처리할 수 없습니다." }, { status: 409 });
    }
    const updated = await resignUser(userId, resignedAt);
    if (!updated) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(updated);
  }

  const { id, action, ...patch } = body;

  // ADMIN 권한을 해제하는 변경이면 총괄관리자·마지막 관리자를 보호한다.
  if (patch.role && patch.role !== "ADMIN") {
    if (await isMasterAdmin(userId)) {
      return NextResponse.json({ error: "총괄관리자 계정의 권한은 변경할 수 없습니다." }, { status: 409 });
    }
    if (await isLastActiveAdmin(userId)) {
      return NextResponse.json({ error: "마지막 남은 관리자 계정의 권한은 변경할 수 없습니다." }, { status: 409 });
    }
  }

  const updated = await updateUser(userId, patch);
  if (!updated) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!isAdmin(sessionUser)) return NextResponse.json({ error: "관리자만 접근 가능합니다." }, { status: 403 });

  const { id: userId } = await params;

  if (sessionUser!.id === userId) {
    return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 409 });
  }
  if (await isMasterAdmin(userId)) {
    return NextResponse.json({ error: "총괄관리자 계정은 삭제할 수 없습니다." }, { status: 409 });
  }
  if (await isLastActiveAdmin(userId)) {
    return NextResponse.json({ error: "마지막 남은 관리자 계정은 삭제할 수 없습니다." }, { status: 409 });
  }

  const ok = await deleteUser(userId);
  if (!ok) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
