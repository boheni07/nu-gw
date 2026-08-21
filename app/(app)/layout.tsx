// Design Ref: §2.6 대시보드 & 알림 — (app) 그룹 전체에서 공유하는 좌측 사이드바 shell + 알림 벨(module-8)
// module-12: mockup/pages/index.html 구조에 맞춰 상단 네비게이션 → 좌측 사이드바 shell로 전환
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserById, listDepartments } from "@/lib/data/store";
import Shell from "./shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) redirect("/login");

  const user = await getUserById(sessionUser.id);
  const department = (await listDepartments()).find((d) => d.id === sessionUser.departmentId);
  // 서버에서 요청 시점 기준으로 1회 계산해 그대로 client shell에 전달한다.
  // (client 모듈 최상단에서 계산하면 프로덕션 빌드에서 Node 모듈 캐싱으로 SSR 값이 고정되어
  //  클라이언트 재계산 값과 어긋나 hydration mismatch(React #418)가 발생한다.)
  // 서버(컨테이너)는 TZ=UTC로 구동될 수 있으므로 timeZone을 명시하지 않으면 자정 전후 날짜가
  // 한국 기준과 하루 어긋난다(예: KST 08:29 == UTC 전날 23:29). 반드시 Asia/Seoul로 고정한다.
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
