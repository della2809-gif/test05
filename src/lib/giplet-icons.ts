import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  CalendarClock,
  Camera,
  CircleHelp,
  ClipboardList,
  Clock,
  Compass,
  Contact,
  DollarSign,
  FileText,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  ImageIcon,
  Leaf,
  Link,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Package,
  Pill,
  Plane,
  PlayCircle,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  Zap,
} from "lucide-react";

export interface GipletIconOption {
  name: string;
  label: string;
  Icon: LucideIcon;
}

// 운영자 아이콘 픽커용 큐레이션 목록.
// name = DB에 저장되는 값(Lucide 컴포넌트 이름). 상담/교육/제품/일정 맥락 중심으로 선별.
// 전체 lucide 동적 import 대신 명시적 레코드로만 관리 (번들 크기 통제).
export const GIPLET_ICON_OPTIONS: GipletIconOption[] = [
  { name: "MessageCircle", label: "상담·대화", Icon: MessageCircle },
  { name: "Stethoscope", label: "건강 상담", Icon: Stethoscope },
  { name: "HeartPulse", label: "건강·바이탈", Icon: HeartPulse },
  { name: "Heart", label: "스토리·마음", Icon: Heart },
  { name: "Pill", label: "약·복용", Icon: Pill },
  { name: "Leaf", label: "건강·자연", Icon: Leaf },
  { name: "Search", label: "검색", Icon: Search },
  { name: "Package", label: "제품·패키지", Icon: Package },
  { name: "ShoppingBag", label: "주문·구매", Icon: ShoppingBag },
  { name: "Gift", label: "쿠폰·선물", Icon: Gift },
  { name: "Sparkles", label: "추천·일반", Icon: Sparkles },
  { name: "DollarSign", label: "수당·정산", Icon: DollarSign },
  { name: "TrendingUp", label: "성장·실적", Icon: TrendingUp },
  { name: "Calculator", label: "계산", Icon: Calculator },
  { name: "Award", label: "보너스·성취", Icon: Award },
  { name: "Plane", label: "여행", Icon: Plane },
  { name: "Briefcase", label: "사업", Icon: Briefcase },
  { name: "Megaphone", label: "홍보·안내", Icon: Megaphone },
  { name: "Target", label: "목표·점검", Icon: Target },
  { name: "Compass", label: "리더·방향", Icon: Compass },
  { name: "Users", label: "회원·명단", Icon: Users },
  { name: "UserPlus", label: "회원 등록", Icon: UserPlus },
  { name: "Contact", label: "연락처", Icon: Contact },
  { name: "Calendar", label: "일정", Icon: Calendar },
  { name: "CalendarClock", label: "일정·마감", Icon: CalendarClock },
  { name: "Clock", label: "시간·주기", Icon: Clock },
  { name: "Bell", label: "알림", Icon: Bell },
  { name: "ClipboardList", label: "체크리스트", Icon: ClipboardList },
  { name: "FileText", label: "문서·자료", Icon: FileText },
  { name: "BookOpen", label: "강의·교육", Icon: BookOpen },
  { name: "GraduationCap", label: "교육·수료", Icon: GraduationCap },
  { name: "PlayCircle", label: "미팅·재생", Icon: PlayCircle },
  { name: "Video", label: "영상", Icon: Video },
  { name: "Link", label: "링크", Icon: Link },
  { name: "ImageIcon", label: "이미지", Icon: ImageIcon },
  { name: "Camera", label: "사진·견적", Icon: Camera },
  { name: "CircleHelp", label: "FAQ·도움말", Icon: CircleHelp },
  { name: "Star", label: "즐겨찾기", Icon: Star },
  { name: "Zap", label: "자동·빠른", Icon: Zap },
];

const GIPLET_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  GIPLET_ICON_OPTIONS.map((o) => [o.name, o.Icon]),
);

/** 저장된 아이콘 이름 → Lucide 컴포넌트. 이름이 없거나 매핑에 없으면 null. */
export function getIconByName(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return GIPLET_ICON_MAP[name] ?? null;
}

/**
 * icon 값이 커스텀 업로드 이미지(public URL)인지 판별.
 * http/https로 시작하면 Lucide 이름이 아니라 이미지로 취급한다. (스키마 변경 없이 하이브리드)
 */
export function isImageIconValue(value?: string | null): boolean {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}
