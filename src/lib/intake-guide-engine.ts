export type IntakeProgramType = "general" | "reset" | "diet" | "custom";
export type IntakeDoseMode = "standard" | "enhanced";

export interface IntakeProductRow {
  id: string;
  name: string;
  aliases: string | null;
  caution: string | null;
}

export interface IntakeGuideRow {
  id: string;
  product_id: string;
  program_type: IntakeProgramType;
  dose_mode: IntakeDoseMode;
  dose_text: string;
  time_labels: string[];
  meal_relation: string | null;
  instructions: string[];
  required_notices: string[];
  cautions: string[];
  source_label: string;
  source_url: string | null;
  source_version: string;
  availability_status: "active" | "pending" | "disabled";
  verification_status: "unverified" | "review_needed" | "verified" | "rejected";
  approval_status: "draft" | "pending" | "approved" | "blocked";
}

export interface IntakeGuideItem {
  productId: string;
  productName: string;
  doseText: string;
  timeLabels: string[];
  mealRelation: string | null;
  instructions: string[];
  requiredNotices: string[];
  cautions: string[];
  sourceLabel: string;
  sourceUrl: string | null;
  sourceVersion: string;
}

export interface IntakeGuidePayload {
  personLabel: string;
  programType: IntakeProgramType;
  doseMode: IntakeDoseMode;
  items: IntakeGuideItem[];
  safetyNotice: string;
}

export type IntakeGuideBuildResult =
  | { status: "ready"; payload: IntakeGuidePayload }
  | { status: "missing_product" | "missing_verified_guide" | "safety_review" | "storage_unavailable"; message: string };

const HIGH_RISK = /(심장|협심|부정맥|림프종|백혈병|암\b|항암|임신|수유|신장|간경화|복용\s*약|처방\s*약|혈액\s*희석|와파린)/;

function aliasesOf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean);
  } catch {
    // 기존 DB에는 쉼표 구분 문자열과 JSON 배열 문자열이 함께 존재한다.
  }
  return raw.split(/[,|]/).map((x) => x.trim()).filter(Boolean);
}

function compact(value: string): string {
  return value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
}

export function resolveIntakeProgram(query: string): { programType: IntakeProgramType; doseMode: IntakeDoseMode } {
  const normalized = compact(query);
  const programType: IntakeProgramType = normalized.includes("리셋")
    ? "reset"
    : /(다이어트|체중|감량)/.test(normalized)
      ? "diet"
      : "general";
  const doseMode: IntakeDoseMode = /(배량|강화|집중)/.test(normalized) ? "enhanced" : "standard";
  return { programType, doseMode };
}

export function matchIntakeProducts(query: string, products: IntakeProductRow[]): IntakeProductRow[] {
  const normalized = compact(query);
  return products.filter((product) => {
    const names = [product.name, ...aliasesOf(product.aliases)].map(compact).filter((x) => x.length >= 2);
    return names.some((name) => normalized.includes(name));
  });
}

function personLabelFrom(query: string): string {
  return query.match(/(엄마|아빠|어머니|아버지|남편|아내|고객|회원|이분|이 사람)/)?.[1] ?? "대상자";
}

export function composeIntakeGuide(query: string, products: IntakeProductRow[], guides: IntakeGuideRow[]): IntakeGuideBuildResult {
  if (HIGH_RISK.test(query)) {
    return { status: "safety_review", message: "질환·임신·복용약과 관련된 섭취방법은 카드부터 만들지 않습니다. 현재 진단명, 복용 중인 약, 의료진 확인 내용을 먼저 알려주세요." };
  }
  const matchedProducts = matchIntakeProducts(query, products);
  if (matchedProducts.length === 0) {
    return { status: "missing_product", message: "섭취방법 카드를 만들 제품명을 알려주세요. 여러 제품이면 제품명을 모두 적어주세요." };
  }
  const { programType, doseMode } = resolveIntakeProgram(query);
  const approved = guides.filter((guide) => guide.program_type === programType && guide.dose_mode === doseMode && guide.availability_status === "active" && guide.verification_status === "verified" && guide.approval_status === "approved");
  const byProduct = new Map(approved.map((guide) => [guide.product_id, guide]));
  const missing = matchedProducts.filter((product) => !byProduct.has(product.id));
  if (missing.length > 0) {
    return { status: "missing_verified_guide", message: `${missing.map((x) => x.name).join(", ")}의 ${doseMode === "enhanced" ? "배량·집중" : "일반"} 섭취 기준이 공식 DB에서 검증·승인되지 않았습니다. 운영자 확인 전에는 임의로 카드를 만들지 않습니다.` };
  }
  const items = matchedProducts.map((product) => {
    const guide = byProduct.get(product.id)!;
    return {
      productId: product.id,
      productName: product.name,
      doseText: guide.dose_text,
      timeLabels: guide.time_labels,
      mealRelation: guide.meal_relation,
      instructions: guide.instructions,
      requiredNotices: guide.required_notices,
      cautions: [...new Set([...guide.cautions, ...(product.caution ? [product.caution] : [])])],
      sourceLabel: guide.source_label,
      sourceUrl: guide.source_url,
      sourceVersion: guide.source_version,
    } satisfies IntakeGuideItem;
  });
  return {
    status: "ready",
    payload: {
      personLabel: personLabelFrom(query), programType, doseMode, items,
      safetyNotice: "이 안내는 승인된 제품 DB 기준입니다. 질환·임신·수유·알레르기·처방약 복용 중에는 의료진 또는 약사에게 먼저 확인하세요.",
    },
  };
}

export async function buildIntakeGuideFromDatabase(supabase: any, query: string): Promise<IntakeGuideBuildResult> {
  const { data: products, error: productError } = await supabase.from("admin_products").select("id,name,aliases,caution");
  if (productError) return { status: "storage_unavailable", message: "제품 DB를 확인하지 못해 섭취방법 카드를 만들 수 없습니다. 잠시 후 다시 시도해주세요." };
  const matched = matchIntakeProducts(query, (products ?? []) as IntakeProductRow[]);
  if (matched.length === 0) return composeIntakeGuide(query, (products ?? []) as IntakeProductRow[], []);
  const { data: guides, error: guideError } = await supabase
    .from("admin_product_intake_guides")
    .select("id,product_id,program_type,dose_mode,dose_text,time_labels,meal_relation,instructions,required_notices,cautions,source_label,source_url,source_version,availability_status,verification_status,approval_status")
    .in("product_id", matched.map((product) => product.id));
  if (guideError) return { status: "storage_unavailable", message: "섭취방법 공식 DB가 아직 연결되지 않았습니다. 제품별 섭취량·시간·주의사항 검증이 끝난 뒤 카드를 만들 수 있습니다." };
  return composeIntakeGuide(query, (products ?? []) as IntakeProductRow[], (guides ?? []) as IntakeGuideRow[]);
}
