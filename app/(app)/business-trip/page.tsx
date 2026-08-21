// Design Ref: module-13 §화면 흐름 — 출장신청(관내/시외) / 신청 내역
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listBusinessTripsByUser } from "@/lib/data/store";
import BusinessTripClient from "./client";

export default async function BusinessTripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await listBusinessTripsByUser(user.id);

  return <BusinessTripClient initialHistory={history} />;
}
