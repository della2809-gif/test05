-- 패키지 마스터 테이블
CREATE TABLE IF NOT EXISTS public.admin_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  components JSONB NOT NULL DEFAULT '[]',  -- [{product_name, quantity, unit_price}]
  price INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  benefit TEXT,
  discount_rate DECIMAL(5,2) DEFAULT 0,
  purpose TEXT,  -- 'reset_1w' | 'reset_2w' | 'challenge_basic' | 'challenge_active'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_packages_active ON admin_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_packages_purpose ON admin_packages(purpose);

-- 초기 패키지 데이터
INSERT INTO admin_packages (name, components, price, score, benefit, discount_rate, purpose) VALUES
(
  '리셋해독 1주 패키지',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 3, "unit_price": 53500},
    {"product_name": "화이버지 플러스", "quantity": 1, "unit_price": 51000},
    {"product_name": "알로엔즈 플러스", "quantity": 1, "unit_price": 68000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  691000,
  0,
  '1주 리셋 기준가. 뉴트리밀 3통(해독 3회/일 × 7일), 화이버지 1통, 알로엔즈 1통, 프로바이오틱 1박스',
  0,
  'reset_1w'
),
(
  '리셋해독 2주 패키지',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 6, "unit_price": 53500},
    {"product_name": "화이버지 플러스", "quantity": 2, "unit_price": 51000},
    {"product_name": "알로엔즈 플러스", "quantity": 2, "unit_price": 68000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  1382000,
  0,
  '2주 리셋 패키지 (1주 기준가 × 2)',
  0,
  'reset_2w'
),
(
  '베이직 챌린지팩',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 2, "unit_price": 53500},
    {"product_name": "메타볼리즘 플러스", "quantity": 1, "unit_price": 56000},
    {"product_name": "화이버지 플러스", "quantity": 3, "unit_price": 51000},
    {"product_name": "프로바이오틱", "quantity": 1, "unit_price": 36500}
  ]',
  369000,
  0,
  '4주 다이어트 챌린지 기본구성. 뉴트리밀 2회/일 × 28일 = 56봉 필요',
  15,
  'challenge_basic'
),
(
  '액티브 챌린지팩',
  '[
    {"product_name": "뉴트리밀 더치초콜릿맛", "quantity": 4, "unit_price": 53500},
    {"product_name": "메타볼리즘 플러스", "quantity": 1, "unit_price": 56000},
    {"product_name": "화이버지 플러스", "quantity": 3, "unit_price": 51000},
    {"product_name": "프로바이오틱", "quantity": 2, "unit_price": 36500},
    {"product_name": "써큘레이트 플러스", "quantity": 1, "unit_price": 97000}
  ]',
  589000,
  0,
  '4주 액티브 챌린지팩. 운동병행, 체지방 25% 이상 추천',
  18,
  'challenge_active'
);
