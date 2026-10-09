import type { Config } from "tailwindcss";
export default { content: { relative: true, files: ["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"] }, theme: { extend: { colors: { campus: "#2ce4cd" } } }, plugins: [] } satisfies Config;
