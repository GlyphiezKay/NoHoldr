import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [{
      source: "/pdf-engine/office/engine.html",
      headers: [{
        key: "Content-Security-Policy",
        value: "default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' blob:; frame-src 'self' about:; img-src data: blob:; style-src 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
      }],
    }];
  },
};

export default nextConfig;
