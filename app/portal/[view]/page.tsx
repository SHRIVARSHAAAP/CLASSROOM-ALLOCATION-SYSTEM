import { notFound, redirect } from "next/navigation";
import { currentUser, demoMode } from "@/backend/auth";
import { navigation } from "@/lib/navigation";
import Workspace from "@/frontend/workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login/student");
  const { view } = await params;
  if (user.role === "faculty" && !["map", "timetable"].includes(view)) redirect("/portal/map");
  if (!navigation[user.role].includes(view)) notFound();
  return <Workspace user={user} demo={demoMode()} view={view} />;
}
