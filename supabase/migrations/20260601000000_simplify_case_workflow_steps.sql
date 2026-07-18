-- 2026-06-01 케이스 구조 단순화
-- 업무 가이드 단계 안에 수집 항목/연결 지플릿을 귀속시키고,
-- admin_cases의 독립 공통 컨텍스트/공통 지플릿 컬럼을 제거합니다.

-- 기존 공통 수집 항목/연결 지플릿을 단계별 guide_steps로 이관합니다.
UPDATE public.admin_cases
SET guide_steps = '[
  {
    "title": "고객 기본 정보와 현재 상황 확인",
    "description": "미팅 대상자의 기본 정보와 현재 상황을 먼저 정리합니다.",
    "collection_items_text": "고객 이름\n나이대/성별\n직업 또는 현재 상황",
    "linked_giplets": ["general"]
  },
  {
    "title": "건강 고민과 핫버튼 정리",
    "description": "고객의 건강 고민, 비즈니스 관심 여부, 움직이는 포인트를 정리합니다.",
    "collection_items_text": "건강 고민\n비즈니스 관심 여부\n핫버튼",
    "linked_giplets": ["story", "link", "faq"]
  },
  {
    "title": "미팅 목적에 맞는 시나리오 선택",
    "description": "1차·2차·3차 미팅 목적에 맞는 대화 흐름을 잡습니다.",
    "collection_items_text": "미팅 차수\n미팅 목적\n고객이 가장 궁금해하는 점",
    "linked_giplets": ["meeting", "youtube"]
  },
  {
    "title": "성공 사례·링크·FAQ 자료 추천",
    "description": "고객 상황에 맞는 참고 자료를 추천합니다.",
    "collection_items_text": "필요한 자료 유형\n고객 성향\n전달 채널",
    "linked_giplets": ["story", "link", "faq", "youtube"]
  },
  {
    "title": "필요 시 수당·여행 달성 시뮬레이션",
    "description": "비즈니스 관심 고객에게 숫자로 시뮬레이션을 보여줍니다.",
    "collection_items_text": "현재 CVP\n목표 수입 또는 여행 목표\n달성 희망 기간",
    "linked_giplets": ["commission", "travel"]
  }
]'::jsonb
WHERE case_key = 'meeting_prep';

UPDATE public.admin_cases
SET guide_steps = '[
  {
    "title": "건강 상태와 생활 환경 확인",
    "description": "신규 상담 대상자의 기본 건강 상태와 생활 환경을 파악합니다.",
    "collection_items_text": "이름 또는 호칭\n나이대/성별\n직업 또는 생활 환경\n가장 불편하거나 개선하고 싶은 건강 고민\n건강 목표\n핫버튼\n사업/비즈니스 관심 여부",
    "linked_giplets": ["general", "faq"]
  },
  {
    "title": "체크리스트 사진 또는 상담 기록 입력",
    "description": "건강체크리스트나 상담 기록을 바탕으로 분석에 필요한 정보를 정리합니다.",
    "collection_items_text": "체크리스트 사진\n상담 메모\n복용 중인 제품\n주의해야 할 건강 정보",
    "linked_giplets": ["quotation", "general"]
  },
  {
    "title": "자동 견적 또는 제품 추천 확인",
    "description": "고객 상태와 예산에 맞춰 제품 조합과 견적을 확인합니다.",
    "collection_items_text": "예산\n섭취 대상\n선호 제품군\n우선순위 건강 목표",
    "linked_giplets": ["quotation", "faq"]
  },
  {
    "title": "고객에게 맞는 성공 사례·링크 자료 추천",
    "description": "고객 상황과 관심사에 맞는 자료를 골라 전달합니다.",
    "collection_items_text": "고객 성향\n관심 주제\n전달할 자료 유형",
    "linked_giplets": ["story", "link", "youtube", "image"]
  },
  {
    "title": "섭취 제품 선택 후 회원 등록",
    "description": "최종 선택 제품과 등록 정보를 정리해 회원 등록으로 이어갑니다.",
    "collection_items_text": "선택 제품\n회원명\n연락처\n가입/등록 경로",
    "linked_giplets": ["contact", "general"]
  },
  {
    "title": "AO·일정·후속 관리 안내",
    "description": "AO 여부, 다음 연락 일정, 후속 관리 포인트를 정리합니다.",
    "collection_items_text": "AO 여부\n다음 연락일\n섭취 시작일\n후속 관리 메모",
    "linked_giplets": ["general", "faq"]
  }
]'::jsonb
WHERE case_key = 'new_product';

ALTER TABLE public.admin_cases
  DROP COLUMN IF EXISTS context_prompt,
  DROP COLUMN IF EXISTS context_fields,
  DROP COLUMN IF EXISTS linked_giplets;
