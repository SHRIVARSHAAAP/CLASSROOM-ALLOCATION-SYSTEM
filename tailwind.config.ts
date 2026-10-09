import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./frontend/**/*.{ts,tsx}"],
  theme: { extend: { colors: { navy: "#1B3A82", teal: "#0E7C7B" } } },
  plugins: [],
} satisfies Config;
