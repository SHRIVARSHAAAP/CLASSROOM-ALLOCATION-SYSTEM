import { redirect } from "next/navigation";
import { currentUser,demoEnabled } from "@/backend/auth";
import PortalShell from "../../components/portal-shell";
import Confirm from "../../components/department-confirm";
export const dynamic="force-dynamic";
export default async function Portal(){const user=await currentUser();if(!user)redirect("/login");return <><PortalShell user={user} demo={demoEnabled()}/>{user.role==="student"&&!user.department_confirmed&&<Confirm roll={user.roll_number??""}/>}</>;}
