import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.3"],
  serverExternalPackages: ["pdf-parse"],
  // pdf-parse → pdfjs-dist 워커 파일을 Vercel 배포 번들에 명시적으로 포함
  // (동적 import라 파일 추적에서 누락 → "Cannot find module pdf.worker.mjs" 오류 방지)
  outputFileTracingIncludes: {
    "/api/admin/files": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
  },
};

export default nextConfig;
