import { redirect } from "next/navigation";
import { currentUser, demoMode } from "@/backend/auth";
import Workspace from "@/frontend/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login/student");
  return <Workspace user={user} demo={demoMode()} view="dashboard" />;
}
