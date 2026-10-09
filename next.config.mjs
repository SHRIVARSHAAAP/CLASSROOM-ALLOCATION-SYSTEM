/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  experimental: { cpus: 2 },
  outputFileTracingExcludes: { "/**": [".env", ".env.*"] },
};
export default config;
