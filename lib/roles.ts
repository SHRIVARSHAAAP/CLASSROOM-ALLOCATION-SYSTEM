import { z } from "zod";
export const roleSchema = z.enum(["admin", "rep", "club_member", "faculty", "student"]);
export type Role = z.infer<typeof roleSchema>;
export const roles = roleSchema.options;
export const roleLabels: Record<Role,string> = {admin:"Administrator",rep:"Class Representative",club_member:"Club Member",faculty:"Faculty",student:"Student"};
export interface CampusUser { id:string; name:string; role:Role; permissions:string[]; department_id?:string|null; department_confirmed?:boolean; roll_number?:string|null; section_id?:string|null; whatsapp_consent:boolean; }
