import type { HealthDomain } from "./types";

const q = (code: string, text: string) => ({ code, text });

export const HEALTH_DOMAINS: HealthDomain[] = [
  {
    code: "blood_sugar", name: "혈당대사", icon: "◫",
    consumerDescription: "식후 졸림, 단 음식 당김, 복부 체중 증가와 관련된 신호",
    functionalDescription: "혈당 변동성과 인슐린 부담 가능성을 살펴보는 영역",
    questions: [
      q("blood_sugar_1", "식후 1~2시간 이내에 졸리거나 집중력이 떨어진다."),
      q("blood_sugar_2", "단 음식이나 빵·면·떡이 자주 당긴다."),
      q("blood_sugar_3", "체중이 쉽게 늘고 잘 빠지지 않는다."),
      q("blood_sugar_4", "공복 시간이 길어지면 예민하거나 힘이 빠진다."),
      q("blood_sugar_5", "복부와 허리 주변으로 살이 찌는 편이다."),
    ],
  },
  {
    code: "energy", name: "에너지", icon: "⚡",
    consumerDescription: "아침 개운함과 오후 활력, 활동 후 회복 상태",
    functionalDescription: "에너지 생산과 일상 활력 저하 가능성을 살펴보는 영역",
    questions: [
      q("energy_1", "아침에 일어나도 개운하지 않다."),
      q("energy_2", "오후가 되면 기운이 급격히 떨어진다."),
      q("energy_3", "충분히 쉬어도 피로가 잘 회복되지 않는다."),
      q("energy_4", "계단이나 가벼운 활동에도 쉽게 지친다."),
      q("energy_5", "운동 후 회복에 이전보다 오랜 시간이 걸린다."),
    ],
  },
  {
    code: "gut", name: "장 건강", icon: "∿",
    consumerDescription: "배변 리듬과 복부 팽만, 음식 후 불편감",
    functionalDescription: "장내환경과 장벽 기능 부담 신호를 살펴보는 영역",
    questions: [
      q("gut_1", "변비 또는 설사가 자주 있다."),
      q("gut_2", "복부 팽만감이나 가스가 자주 생긴다."),
      q("gut_3", "배변 후에도 시원하지 않다."),
      q("gut_4", "특정 음식을 먹으면 복통이나 불편감이 생긴다."),
      q("gut_5", "식사 상태에 따라 배변 상태가 크게 달라진다."),
    ],
  },
  {
    code: "inflammation", name: "염증", icon: "✦",
    consumerDescription: "붓기, 뻐근함, 오래 지속되는 통증과 관련된 신호",
    functionalDescription: "만성 염증 부담 가능성을 살펴보는 영역",
    questions: [
      q("inflammation_1", "특별한 이유 없이 몸이 자주 붓는다."),
      q("inflammation_2", "관절이나 근육이 자주 뻐근하거나 아프다."),
      q("inflammation_3", "피로할 때 몸살처럼 몸이 무겁고 아프다."),
      q("inflammation_4", "작은 염증이나 통증이 오래 지속된다."),
      q("inflammation_5", "수면이나 스트레스가 부족하면 통증이 심해진다."),
    ],
  },
  {
    code: "immunity", name: "면역", icon: "♢",
    consumerDescription: "감염 빈도와 회복 속도, 알레르기 반복 여부",
    functionalDescription: "면역 회복력 부담 신호를 살펴보는 영역",
    questions: [
      q("immunity_1", "감기나 감염성 질환에 자주 걸린다."),
      q("immunity_2", "감기에 걸리면 회복하는 데 오래 걸린다."),
      q("immunity_3", "입병이나 구내염이 자주 생긴다."),
      q("immunity_4", "알레르기 증상이 반복된다."),
      q("immunity_5", "상처나 피부 손상이 잘 낫지 않는다."),
    ],
  },
  {
    code: "hormone", name: "호르몬", icon: "◎",
    consumerDescription: "체중, 기분, 수면, 체온과 활력의 주기적 변화",
    functionalDescription: "호르몬 균형 변화 가능성을 살펴보는 영역",
    questions: [
      q("hormone_1", "특별한 이유 없이 체중이 쉽게 변한다."),
      q("hormone_2", "오후가 되면 급격히 피곤하거나 무기력해진다."),
      q("hormone_3", "수면과 기분의 변화가 주기적으로 나타난다."),
      { code: "hormone_4", text: "활력이나 성욕 저하를 느낀다.", genderText: {
        female: "생리·갱년기 변화 또는 활력 저하를 느낀다.",
        male: "활력이나 성욕 저하를 느낀다.",
      }},
      q("hormone_5", "더위나 추위에 예민하고 체온 변화가 크다."),
    ],
  },
  {
    code: "detox", name: "해독", icon: "◇",
    consumerDescription: "음주·약물·환경 노출 후 회복과 민감 반응",
    functionalDescription: "간·해독 부담 가능성을 살펴보는 영역",
    questions: [
      q("detox_1", "술을 마신 뒤 회복하는 데 오래 걸린다."),
      q("detox_2", "약이나 건강기능식품을 여러 종류 장기간 섭취한다."),
      q("detox_3", "담배연기, 미세먼지, 화학제품 등에 자주 노출된다."),
      q("detox_4", "냄새나 화학제품에 예민하게 반응한다."),
      q("detox_5", "음주나 과식 후 피로, 두통 또는 소화 불편이 심하다."),
    ],
  },
  {
    code: "brain_nerve", name: "뇌·신경", icon: "⌁",
    consumerDescription: "집중력, 기억력, 긴장과 감정 반응의 변화",
    functionalDescription: "자율신경과 스트레스 부담 가능성을 살펴보는 영역",
    questions: [
      q("brain_nerve_1", "집중력이 예전보다 떨어졌다."),
      q("brain_nerve_2", "기억력이나 단어 회상이 예전 같지 않다."),
      q("brain_nerve_3", "불안하거나 쉽게 긴장된다."),
      q("brain_nerve_4", "사소한 일에도 쉽게 짜증이 난다."),
      q("brain_nerve_5", "두통, 어지럼증 또는 손발 저림이 반복된다."),
    ],
  },
  {
    code: "circulation", name: "순환", icon: "↻",
    consumerDescription: "손발 냉감, 붓기, 숨참과 하체 무거움",
    functionalDescription: "혈관·순환 부담 가능성을 살펴보는 영역",
    questions: [
      q("circulation_1", "손발이 차거나 저린 느낌이 있다."),
      q("circulation_2", "손이나 발이 자주 붓는다."),
      q("circulation_3", "계단을 오르면 숨이 차거나 심장이 두근거린다."),
      q("circulation_4", "혈압이나 콜레스테롤 수치가 높다고 들었다."),
      q("circulation_5", "오래 앉아 있으면 다리가 무겁고 불편하다."),
    ],
  },
  {
    code: "musculoskeletal", name: "골격·근육", icon: "⌇",
    consumerDescription: "관절 움직임, 근력과 운동 후 회복 상태",
    functionalDescription: "근골격 기능과 영양·회복 부담 신호를 살펴보는 영역",
    questions: [
      q("musculoskeletal_1", "목, 어깨 또는 허리 통증이 반복된다."),
      q("musculoskeletal_2", "관절이 뻣뻣하거나 움직일 때 불편하다."),
      q("musculoskeletal_3", "예전보다 근력이 떨어졌다고 느낀다."),
      q("musculoskeletal_4", "근육통이나 쥐가 자주 난다."),
      q("musculoskeletal_5", "운동 후 근육과 관절의 회복이 느리다."),
    ],
  },
  {
    code: "skin_aging", name: "피부·노화", icon: "✺",
    consumerDescription: "피부·모발·손톱과 손상 후 회복 상태",
    functionalDescription: "산화·당화 스트레스와 영양 부담 가능성을 살펴보는 영역",
    questions: [
      q("skin_aging_1", "피부가 건조하고 거칠다."),
      q("skin_aging_2", "피부 탄력이 줄고 주름이 늘었다."),
      q("skin_aging_3", "머리카락이 많이 빠지거나 가늘어졌다."),
      q("skin_aging_4", "손톱이 약해지거나 잘 부러진다."),
      q("skin_aging_5", "상처, 멍 또는 피부 트러블의 회복이 느리다."),
    ],
  },
  {
    code: "recovery", name: "회복력", icon: "☾",
    consumerDescription: "수면의 질과 스트레스·활동 후 회복 속도",
    functionalDescription: "수면 및 전신 회복 부담 가능성을 살펴보는 영역",
    questions: [
      q("recovery_1", "잠드는 데 30분 이상 걸린다."),
      q("recovery_2", "밤중에 자주 깨거나 깊게 자지 못한다."),
      q("recovery_3", "충분히 자도 아침에 피곤하다."),
      q("recovery_4", "스트레스나 과로 후 회복하는 데 오래 걸린다."),
      q("recovery_5", "운동이나 외출 다음 날까지 피로가 지속된다."),
    ],
  },
];

export const ANSWER_OPTIONS = [
  { value: 0, label: "전혀 그렇지 않다" },
  { value: 1, label: "가끔 그렇다" },
  { value: 2, label: "자주 그렇다" },
  { value: 3, label: "거의 항상 그렇다" },
];

export const PRIORITY_ORDER = [
  "blood_sugar", "circulation", "recovery", "energy", "inflammation", "gut",
  "hormone", "immunity", "brain_nerve", "musculoskeletal", "detox", "skin_aging",
];
