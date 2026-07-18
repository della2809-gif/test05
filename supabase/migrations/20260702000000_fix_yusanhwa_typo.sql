-- 유산화 → 유사나 오타 정정 (음성 받아쓰기 오류)
-- 배경: docs/operations/GENIEA_W1_조사결과_2026-07-02.md W1-A §2
--
-- 배포 시점 실행 순서(중요):
--   1) 기존/유입된 '유산화' 행을 '유사나'로 정정
--   2) CHECK 제약에서 '유산화'를 제거하여 최종 상태로 좁힌다
--
-- 주의: 이 파일은 신규 코드가 프로덕션에 배포되는 시점에 함께 적용해야 한다.
-- 배포 전 라이브 DB에는 이미 임시로 '유산화'+'유사나' 둘 다 허용하도록 제약이 확장돼 있고
-- 기존 28행은 '유사나'로 정정된 상태다. 이 마이그레이션은 그 확장을 최종 상태로 마무리한다.
-- (구 프로덕션 코드가 배포 전까지 신규 '유산화' 행을 계속 만들 수 있으므로 UPDATE를 다시 수행)

BEGIN;

UPDATE schedules SET life_layer = '유사나' WHERE life_layer = '유산화';

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_life_layer_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_life_layer_check
  CHECK (life_layer IN ('개인', '가족', '본업', '유사나', '투잡'));

COMMIT;
