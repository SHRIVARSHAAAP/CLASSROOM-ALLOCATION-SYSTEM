import { notFound } from "next/navigation";
import Login from "@/frontend/login";
import { roleSchema } from "@/lib/types";
import { demoMode } from "@/backend/auth";
export default async function Page({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const input = await params;
  const role = roleSchema.safeParse(input.role);
  if (!role.success) notFound();
  return <Login role={role.data} demo={demoMode()} />;
}
