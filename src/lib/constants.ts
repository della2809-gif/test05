export const APP_NAME = "지니아";

// 지플릿 컬러 프리셋 (giplet_key color_scheme 값 → Tailwind 클래스)
export const GIPLET_COLOR_PRESETS: Record<string, { color: string; bg: string; border: string }> = {
  blue:    { color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800'    },
  emerald: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  purple:  { color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/40',  border: 'border-purple-200 dark:border-purple-800'  },
  amber:   { color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/40',    border: 'border-amber-200 dark:border-amber-800'    },
  rose:    { color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-950/40',      border: 'border-rose-200 dark:border-rose-800'      },
  cyan:    { color: 'text-cyan-600 dark:text-cyan-400',      bg: 'bg-cyan-50 dark:bg-cyan-950/40',      border: 'border-cyan-200 dark:border-cyan-800'      },
  pink:    { color: 'text-pink-600 dark:text-pink-400',      bg: 'bg-pink-50 dark:bg-pink-950/40',      border: 'border-pink-200 dark:border-pink-800'      },
  indigo:  { color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/40',  border: 'border-indigo-200 dark:border-indigo-800'  },
  yellow:  { color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-50 dark:bg-yellow-950/40',  border: 'border-yellow-200 dark:border-yellow-800'  },
  red:     { color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/40',        border: 'border-red-200 dark:border-red-800'        },
  violet:  { color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-50 dark:bg-violet-950/40',  border: 'border-violet-200 dark:border-violet-800'  },
  teal:    { color: 'text-teal-600 dark:text-teal-400',      bg: 'bg-teal-50 dark:bg-teal-950/40',      border: 'border-teal-200 dark:border-teal-800'      },
  orange:  { color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/40',  border: 'border-orange-200 dark:border-orange-800'  },
  gray:    { color: 'text-foreground-secondary',              bg: 'bg-surface',                          border: 'border-border'                             },
};

export function getGipletColors(colorScheme: string) {
  return GIPLET_COLOR_PRESETS[colorScheme] ?? GIPLET_COLOR_PRESETS.gray;
}
export const APP_DESCRIPTION = "AI 기록 정리 서비스";

export const SIDEBAR_WIDTH = 260;
export const ADMIN_SIDEBAR_WIDTH = 240;
export const HEADER_HEIGHT = 56; // h-14
export const MOBILE_HEADER_HEIGHT = 48; // h-12
export const BOTTOM_TAB_HEIGHT = 56; // h-14

export const MESSAGES_PER_PAGE = 50;

// 아카이브 카테고리
export const ARCHIVE_CATEGORIES = {
  personal: '개인',
  schedule: '일정 관리',
  contacts: '회원',
  consultation: '상담 기록',
  lecture: '강의 기록',
  meeting: '회의 기록',
  etc: '개인/기타',
} as const;

export type ArchiveCategoryKey = keyof typeof ARCHIVE_CATEGORIES;

// 모드
export const MODES = {
  self: '셀프',
  guide: '가이드',
} as const;

// 성향
export const PERSONALITIES = {
  logical: '논리적',
  emotional: '감성적',
  practical: '실용적',
} as const;

// 상태
export const USER_STATUS = {
  free: 'Free',
  paid: 'Paid',
} as const;

// 카테고리 뱃지 색상
export const CATEGORY_COLORS: Record<ArchiveCategoryKey, { bg: string; text: string; darkBg: string; darkText: string }> = {
  personal:     { bg: '#EFF6FF', text: '#1D4ED8', darkBg: '#1E3A5F', darkText: '#93C5FD' },
  schedule:     { bg: '#FEF3C7', text: '#B45309', darkBg: '#451A03', darkText: '#FCD34D' },
  contacts:     { bg: '#F0FDF4', text: '#15803D', darkBg: '#052E16', darkText: '#86EFAC' },
  consultation: { bg: '#FDF2F8', text: '#BE185D', darkBg: '#500724', darkText: '#F9A8D4' },
  lecture:      { bg: '#EDE9FE', text: '#7C3AED', darkBg: '#2E1065', darkText: '#C4B5FD' },
  meeting:      { bg: '#FFF7ED', text: '#C2410C', darkBg: '#431407', darkText: '#FDBA74' },
  etc:          { bg: '#F3F4F6', text: '#4B5563', darkBg: '#1F2937', darkText: '#D1D5DB' },
};

// 관리자 사이드바 메뉴 (섹션 구조)
export const ADMIN_MENU_SECTIONS = [
  {
    section: '시스템',
    items: [
      { href: '/admin', label: '대시보드', icon: 'LayoutDashboard' },
      { href: '/admin/users', label: '사용자 관리', icon: 'Users' },
    ],
  },
  {
    section: '워크플로우',
    items: [
      { href: '/admin/giplets', label: '지플릿 관리', icon: 'Zap' },
      { href: '/admin/cases', label: '케이스 관리', icon: 'Workflow' },
      { href: '/admin/content-ai', label: 'Content AI', icon: 'BrainCircuit' },
    ],
  },
  {
    section: 'DB 관리',
    items: [
      { href: '/admin/templates', label: '미팅 시나리오', icon: 'FileText' },
      { href: '/admin/calculations', label: '수당·여행 계산값', icon: 'Calculator' },
      { href: '/admin/products', label: '제품 DB', icon: 'Package' },
      { href: '/admin/packages', label: '패키지 DB', icon: 'Package2' },
      { href: '/admin/stories', label: '스토리 DB', icon: 'BookOpen' },
      { href: '/admin/links', label: '링크 DB', icon: 'LinkIcon' },
      { href: '/admin/faqs', label: 'FAQ DB', icon: 'HelpCircle' },
      { href: '/admin/images', label: '이미지 DB', icon: 'ImageIcon' },
      { href: '/admin/youtube', label: '유튜브·강의 DB', icon: 'Video' },
      { href: '/admin/files', label: '레퍼런스 파일', icon: 'Upload' },
      { href: '/admin/blocks', label: '스크립트 DB', icon: 'Blocks' },
    ],
  },
] as const;

// 하위 호환 flat 배열
export const ADMIN_MENU: { href: string; label: string; icon: string }[] =
  ADMIN_MENU_SECTIONS.flatMap((s) =>
    (s.items as unknown as { href: string; label: string; icon: string }[])
  );

// ─────────────────────────────────────────
// 지플릿 정의
// ─────────────────────────────────────────

export type GipletType =
  | 'general' | 'quotation' | 'commission' | 'travel'
  | 'contact' | 'story' | 'link' | 'image'
  | 'meeting' | 'faq' | 'youtube';

export interface GipletDef {
  type: GipletType;
  label: string;
  description: string;
  tag: string;
  color: string;       // Tailwind text color
  bg: string;          // Tailwind bg color
  border: string;      // Tailwind border color
  /** 채팅 시작 시 입력창에 미리 채워질 프롬프트 (없으면 빈 채팅) */
  prompt?: string;
  /** 채팅 대신 페이지 이동 */
  href?: string;
  /** 이미지 첨부 힌트 표시 */
  uploadHint?: boolean;
}

export const GIPLETS: GipletDef[] = [
  {
    type: 'quotation',
    label: '자동 견적',
    description: '건강체크리스트 사진 → A~J 분석 → 3단계 제품 견적 자동 출력',
    tag: '📸 사진 첨부',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    prompt: '건강체크리스트 사진을 찍어서 올려주세요. 분석 후 맞춤 견적을 드릴게요.',
    uploadHint: true,
  },
  {
    type: 'commission',
    label: '수당 계산',
    description: '현재 CVP 입력 → 직급 확인 + 3가지 시나리오 수당 계산',
    tag: '💰 CVP 입력',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    prompt: '수당 계산해줘. 현재 CVP는 ',
  },
  {
    type: 'travel',
    label: '여행 달성',
    description: '여행 목표 비용 역산 → 필요 CVP → 달성 기간 3가지 시나리오',
    tag: '✈️ CVP 입력',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    prompt: '여행 달성 계산해줘. 현재 CVP는 ',
  },
  {
    type: 'contact',
    label: '회원 관리',
    description: '이름·가입일·연락처 입력 → 회원 자동 등록 + AO 주기 설정',
    tag: '👤 회원 연동',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    prompt: '새 회원을 등록할게요. 이름이 어떻게 되시나요?',
  },
  {
    type: 'story',
    label: '성공 스토리',
    description: '고객과 비슷한 상황의 건강회복·비즈니스 성공 사례 검색',
    tag: '📖 사례 검색',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800',
    prompt: '비슷한 성공 사례를 찾아줘. ',
  },
  {
    type: 'link',
    label: '링크 자료',
    description: '고객 성향·컨디션에 맞는 유튜브·외부 링크 자료 선별 제공',
    tag: '🔗 링크 추천',
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    border: 'border-cyan-200 dark:border-cyan-800',
    prompt: '이 고객에게 맞는 링크 자료를 추천해줘. ',
  },
  {
    type: 'image',
    label: '이미지 자료',
    description: '이미 준비된 마케팅 이미지·비포애프터 자료 검색 및 제공',
    tag: '🖼️ 이미지 검색',
    color: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    border: 'border-pink-200 dark:border-pink-800',
    prompt: '이미지 자료를 찾아줘. ',
  },
  {
    type: 'meeting',
    label: '미팅 시나리오',
    description: '1차·2차·3차 미팅 흐름 스크립트와 상황별 질문 가이드',
    tag: '📋 미팅 가이드',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
    prompt: '미팅 시나리오를 알려줘. ',
  },
  {
    type: 'faq',
    label: 'FAQ',
    description: '자주 묻는 질문에 대한 답변을 DB에서 검색하여 제공',
    tag: '❓ 질문 검색',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    border: 'border-yellow-200 dark:border-yellow-800',
    prompt: '자주 묻는 질문: ',
  },
  {
    type: 'youtube',
    label: '유튜브 강의',
    description: '강의 스크립트·요약을 기반으로 제품·비즈니스 관련 내용 답변',
    tag: '🎬 강의 검색',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    prompt: '강의 내용에서 알려줘. ',
  },
  {
    type: 'general',
    label: '자유 상담',
    description: '제품 질문, 고객 응대 멘트, 미팅 준비 등 무엇이든 질문',
    tag: '💬 자유 입력',
    color: 'text-foreground-secondary',
    bg: 'bg-surface',
    border: 'border-border',
    prompt: '',
  },
];

// 지플릿별 참조 DB 매핑 (Option A — 코드에 선언)
// 값: openai.ts에서 로드할 테이블 키
export const GIPLET_DB_MAP: Record<GipletType, string[]> = {
  general:    ['templates', 'blocks', 'calculations', 'products', 'packages', 'stories', 'links', 'images', 'youtube'],
  quotation:  ['products', 'packages'],
  commission: ['calculations'],
  // travel에 images 포함: 여행 달성 조건표(프로모션 플라이어)가 Image DB에 있어, 조건 질문 시
  // 일반 여행비 역산으로 새지 않고 조건표를 근거로 답하게 한다. (클라이언트 7/5 피드백)
  travel:     ['calculations', 'images'],
  contact:    [],                              // function calling only
  story:      ['stories'],
  link:       ['links'],
  image:      ['images'],
  meeting:    ['templates', 'blocks'],
  faq:        ['rag:faqs'],
  youtube:    ['youtube'],
};

// 수당 계산·여행 달성 필수 안전문구 (대표 지정). 프롬프트 레이어(openai.ts)와 계산 카드
// (commission-result / travel-result) 두 경로가 동일 문구를 쓰도록 단일 출처로 관리한다. (검수 #32/#33)
export const COMMISSION_TRAVEL_DISCLAIMER =
  '예상 시뮬레이션이며 공식 보상플랜이 우선합니다. 외부 공유는 하지 말아주세요.';

// 지플릿 타입으로 정의 조회
export function getGiplet(type: string): GipletDef {
  return GIPLETS.find((g) => g.type === type) ?? GIPLETS.find((g) => g.type === 'general')!;
}

// 지원 파일 형식
export const SUPPORTED_FILE_TYPES = {
  document: ['.pdf', '.txt', '.xlsx'],
  image: ['.jpg', '.jpeg', '.png'],
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 채팅 업로드 용량 한도 — Vercel 서버리스 함수의 요청 본문 한도(약 4.5MB)를 넘으면
// 코드에 도달하기 전에 플랫폼이 413으로 막아 "원인 모를 업로드 실패"가 발생한다.
// (특히 PC에서 큰 원본 이미지를 올릴 때). 안전 마진을 둬 4.5MB로 제한하고 명확히 안내한다.
export const UPLOAD_SIZE_LIMIT = Math.round(4.5 * 1024 * 1024); // 약 4.5MB
