export const departmentConfig: Record<string,string> = {
 B:"Biomedical", A:"Civil", Z:"CSE", E:"EEE", L:"ECE", N:"AIML", T:"Textile", I:"IT", R:"Robotics", F:"Fashion Technology", P:"Production Engineering", U:"Automobile"
};
export function parseRollNumber(roll:string): {year:number;deptCode:string;department:string|null}|null {
 const match=/^(\d{2})([a-z])(\d+)$/i.exec(roll.trim());
 if(!match)return null;
 const deptCode=match[2].toUpperCase();
 return {year:2000+Number(match[1]),deptCode,department:departmentConfig[deptCode]??null};
}
