import { defineConfig } from "vitest/config";

// 테스트 대상을 이 프로젝트의 src/ 로 한정한다.
// (.tmp-knowledge-mcp/, .hermes/ 등 레포 안에 임시로 존재하는 외부 프로젝트의
//  테스트 파일이 npm test 에 딸려 들어와 jsdom 미설치 오류를 내는 것을 방지)
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      ".tmp-knowledge-mcp/**",
      ".hermes/**",
    ],
  },
});
