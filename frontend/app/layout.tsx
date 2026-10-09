import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Smart Campus | Room Management",description:"Fixed timetables, smarter room allocation and connected campus portals."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
