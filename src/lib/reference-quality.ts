export interface ReferenceTextQualityMetrics {
  length: number;
  hangulRatio: number;
  suspiciousRatio: number;
  replacementCharCount: number;
  knownOcrErrorCount: number;
}

export interface ReferenceTextQualityResult {
  ok: boolean;
  reason: string | null;
  metrics: ReferenceTextQualityMetrics;
}

const HANGUL_RE = /[가-힣]/g;
const SUSPICIOUS_RE = /[簇純瞬嘗昌虧圍翩隘媚唇樺澍嗽嘲琮]|[☜■□▣◇▷▶●○⊃㈜㉵ⓒ]|[ÃÂ�]/g;
const KNOWN_OCR_ERROR_PATTERNS = [
  /\b히고\b/g,
  /히셨/g,
  /깁자기/g,
  /갑직/g,
  /기cl/g,
  /돌o/g,
  /괴시/g,
  /건깅/g,
  /질봔/g,
  /딩뇨/g,
];

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

export function assessReferenceTextQuality(
  text: string | null | undefined,
  fileType: string
): ReferenceTextQualityResult {
  const value = text ?? "";
  const length = value.length;
  const hangulCount = countMatches(value, HANGUL_RE);
  const suspiciousCount = countMatches(value, SUSPICIOUS_RE);
  const replacementCharCount = countMatches(value, /�/g);
  const knownOcrErrorCount = KNOWN_OCR_ERROR_PATTERNS.reduce(
    (sum, pattern) => sum + countMatches(value, pattern),
    0
  );

  const metrics: ReferenceTextQualityMetrics = {
    length,
    hangulRatio: length > 0 ? hangulCount / length : 0,
    suspiciousRatio: length > 0 ? (suspiciousCount + replacementCharCount) / length : 0,
    replacementCharCount,
    knownOcrErrorCount,
  };

  // TXT/XLSX are usually human-authored or structured exports. Decorative separators such as
  // ━━━━━━━━━ are expected there, so only PDF auto-extraction is gated.
  if (fileType.toLowerCase() !== "pdf") {
    return { ok: true, reason: null, metrics };
  }

  if (length < 30) {
    return {
      ok: false,
      reason: "PDF 텍스트 추출 품질이 낮습니다: 추출된 텍스트가 너무 짧습니다. OCR/정제 TXT로 대체 업로드가 필요합니다.",
      metrics,
    };
  }

  if (metrics.suspiciousRatio > 0.05 || replacementCharCount > 0 || knownOcrErrorCount >= 2) {
    return {
      ok: false,
      reason: "PDF 텍스트 추출 품질이 낮습니다: OCR/폰트 매핑 오류로 보이는 문자와 오인식 패턴이 많습니다. 원본 PDF는 보관하지만 RAG chunk 자동 생성은 건너뜁니다.",
      metrics,
    };
  }

  return { ok: true, reason: null, metrics };
}
