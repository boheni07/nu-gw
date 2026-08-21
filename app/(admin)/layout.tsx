// Design Ref: §2.5 관리자 기능 — 일반 사용자와 동일한 sidebar shell을 공유하고 "관리자" nav 그룹만 추가로 노출한다.
// module-12: 별도의 admin 전용 미니 사이드바를 제거하고 (app) 그룹의 Shell을 재사용해 디자인을 통일한다(mockup/pages/index.html 기준).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/auth/rbac";
import { getUserById, listDepartments } from "@/lib/data/store";
import Shell from "../(app)/shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");
  if (!isAdmin(sessionUser)) redirect("/dashboard");

  const user = await getUserById(sessionUser.id);
  const department = (await listDepartments()).find((d) => d.id === sessionUser.departmentId);
  // (app)/layout.tsx와 동일한 이유로 요청 시점 기준 서버 계산 값을 전달한다(hydration mismatch 방지).
  // timeZone을 명시하지 않으면 서버(TZ=UTC)와 한국 기준 날짜가 자정 전후로 어긋난다.
  const todayLabel = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });

  return (
    <Shell
      userName={sessionUser.name}
      position={user?.position ?? ""}
      department={department?.name ?? ""}
      role={sessionUser.role}
      todayLabel={todayLabel}
    >
      {children}
    </Shell>
  );
}
