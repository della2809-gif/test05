import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 분석 결과 타입
export interface HealthChecklistAnalysis {
  scores: {
    A: number | null; // 면역
    B: number | null; // 순환
    C: number | null; // 소화
    D: number | null; // 장관
    E: number | null; // 뇌신경
    F: number | null; // 호르몬
    G: number | null; // 호흡
    H: number | null; // 비뇨
    I: number | null; // 골격
    J: number | null; // 피부모발
  };
  lifestyle: {
    goal: string | null;
    diet: string | null;
    sleep: string | null;
    exercise: string | null;
    notes: string | null;
  };
  inbody: {
    weight: number | null;
    bodyFatPercent: number | null;
    visceralFat: number | null;
    skeletalMuscle: number | null;
    bmi: number | null;
  } | null;
  /** 그래프의 색 구간(양호/보통/경계/불량)을 이미지에서 직접 읽은 값. 없으면 점수 구간으로 폴백 */
  grades?: Partial<Record<
    "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J",
    "양호" | "보통" | "경계" | "불량" | null
  >> | null;
  summary: string; // 전체 요약 1~2문장
}

const ANALYSIS_PROMPT = `당신은 USANA 건강 상담 전문가입니다. 업로드된 건강 자가체크리스트 이미지를 분석하세요.

체크리스트는 A~J 10개 영역으로 구성됩니다:
A = 면역 (감기, 알레르기, 피로감)
B = 순환 (혈액순환, 손발저림, 부종)
C = 소화 (위장, 식욕, 소화불량)
D = 장관 (변비, 설사, 장트러블)
E = 뇌신경 (집중력, 기억력, 수면의 질)
F = 호르몬 (생리불순, 갱년기, 피부트러블)
G = 호흡 (비염, 기관지, 호흡곤란)
H = 비뇨 (신장, 방광, 부종)
I = 골격 (관절, 뼈, 근육통)
J = 피부모발 (피부건조, 탈모, 손발톱)

각 영역은 체크 개수 또는 점수로 표시됩니다. 이미지에서 읽을 수 있는 값을 그대로 추출하세요.
읽을 수 없는 항목은 null로 반환하세요. 절대 값을 추측하거나 지어내지 마세요.

건강체크 그래프에 색 구간(양호/보통/경계/불량 또는 초록/노랑/주황/빨강 밴드)이 보이면,
각 영역의 막대·점이 어느 구간에 있는지도 함께 추출하세요. (초록=양호, 노랑=보통, 주황=경계, 빨강=불량)
구간을 눈으로 확인할 수 없으면 해당 영역은 null로 두세요.

또한 다음 정보도 추출하세요:
- 생활습관: 목표, 식습관, 수면, 운동, 특이사항
- 인바디(있는 경우): 체중, 체지방률, 내장지방, 골격근량, BMI

반드시 아래 JSON 형식으로만 응답하세요:
{
  "scores": {"A": 숫자또는null, "B": ..., "C": ..., "D": ..., "E": ..., "F": ..., "G": ..., "H": ..., "I": ..., "J": ...},
  "grades": {"A": "양호|보통|경계|불량 또는 null", "B": ..., "C": ..., "D": ..., "E": ..., "F": ..., "G": ..., "H": ..., "I": ..., "J": ...},
  "lifestyle": {"goal": "문자열또는null", "diet": ..., "sleep": ..., "exercise": ..., "notes": ...},
  "inbody": {"weight": 숫자또는null, "bodyFatPercent": ..., "visceralFat": ..., "skeletalMuscle": ..., "bmi": ...} 또는 null,
  "summary": "전체 건강 상태 요약 1~2문장"
}`;

export async function POST(request: NextRequest) {
  // 인증 확인
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // FormData 파싱
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const imageFiles = formData.getAll("images") as File[];
  if (imageFiles.length === 0) {
    return NextResponse.json(
      { error: "이미지를 최소 1장 업로드해주세요." },
      { status: 400 }
    );
  }
  if (imageFiles.length > 3) {
    return NextResponse.json(
      { error: "이미지는 최대 3장까지 업로드 가능합니다." },
      { status: 400 }
    );
  }

  // 이미지를 base64로 변환
  const imageContents = await Promise.all(
    imageFiles.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const mimeType = file.type || "image/jpeg";
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: "high" as const,
        },
      };
    })
  );

  // Vision API 호출
  const messages = [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: ANALYSIS_PROMPT },
        ...imageContents,
      ],
    },
  ];

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => null);
    return NextResponse.json(
      {
        error: `Vision API 오류: ${err?.error?.message ?? openaiRes.statusText}`,
      },
      { status: 500 }
    );
  }

  const openaiData = await openaiRes.json();
  const rawContent = openaiData.choices?.[0]?.message?.content;

  if (!rawContent) {
    return NextResponse.json(
      { error: "AI 응답을 받지 못했습니다." },
      { status: 500 }
    );
  }

  let analysis: HealthChecklistAnalysis;
  try {
    analysis = JSON.parse(rawContent) as HealthChecklistAnalysis;
  } catch {
    return NextResponse.json(
      { error: "응답 파싱 실패", raw: rawContent },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: analysis });
}
