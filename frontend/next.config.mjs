import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.ATS_API_URL ?? "http://127.0.0.1:8095";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: __dirname },
  output: "standalone",
  poweredByHeader: false,
  // Attachment uploads (up to 20 MB a file, several files) pass through this server on their way to the API.
  experimental: { middlewareClientMaxBodySize: "100mb" },
  async rewrites() {
    // The browser only ever talks to this origin, so the SameSite=Strict
    // session cookie set by the backend travels with every API call.
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
