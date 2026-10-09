import { redirect } from "next/navigation";
import { currentUser } from "@/backend/auth";
import RoomFinder from "../../../components/room-finder";
export const dynamic="force-dynamic";
export default async function Page(){const user=await currentUser();if(!user)redirect("/login");return <RoomFinder/>;}
