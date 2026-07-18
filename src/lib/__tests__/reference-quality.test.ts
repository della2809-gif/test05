import { describe, expect, it } from "vitest";

import { assessReferenceTextQuality } from "../reference-quality";

describe("assessReferenceTextQuality", () => {
  it("accepts clean Korean reference text", () => {
    const text = "간절하게 노력해서 되찾은 간 건강. 저는 예쁜 딸 셋을 키우며 예약제로 네일아트를 하고 있습니다. 건강 관리 기록을 정리한 문서입니다.";

    const result = assessReferenceTextQuality(text, "pdf");

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("rejects noisy PDF extraction before storing RAG chunks", () => {
    const text = "당신의 혈액은 어떤가요? ● 슷簇 렬 삔 :' 긍 ■iF ☜ 純 뙤 뷕r-봐 ⊃겼 瞬 클嘗> 느륙 →모昌J 체험을통해 밝혀잔 건깅이이기";

    const result = assessReferenceTextQuality(text, "pdf");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("PDF 텍스트 추출 품질이 낮습니다");
    expect(result.metrics.suspiciousRatio).toBeGreaterThan(0.05);
  });

  it("does not block non-PDF text inputs with decorative separators", () => {
    const text = "# GENIEA DB 입력용\n━━━━━━━━━━━━━━━━━━\n제품 평가 기준과 근거를 정리합니다.";

    const result = assessReferenceTextQuality(text, "txt");

    expect(result.ok).toBe(true);
  });
});
