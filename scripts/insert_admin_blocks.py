"""
admin_blocks 테이블에 스토리 지플릿 및 일정관리 지플릿 데이터를 삽입하는 스크립트.

Usage:
    python scripts/insert_admin_blocks.py
"""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from typing import Iterator

import httpx

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SERVICE_KEY:
    raise RuntimeError(
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    )
ENDPOINT = f"{SUPABASE_URL}/rest/v1/admin_blocks"
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

STORY_FILE = Path(
    "/Users/kimnayeon/Desktop/chatgpt/00_requirements"
    "/위시캣 매니저님 첨부 20260410/3_스토리 지플릿 DB.txt"
)
SCHEDULE_FILE = Path(
    "/Users/kimnayeon/Desktop/chatgpt/00_requirements"
    "/위시캣 매니저님 첨부 20260410/12_일정관리.txt"
)

# 콘텐츠가 이 길이를 초과하면 섹션별로 분리해 삽입
MAX_CONTENT_LEN = 8000


# ──────────────────────────────────────────────
# 파싱 함수
# ──────────────────────────────────────────────

def _clean(text: str) -> str:
    """앞뒤 공백·빈 줄 정리."""
    return text.strip()


def _split_by_len(text: str, max_len: int = MAX_CONTENT_LEN) -> list[str]:
    """텍스트가 max_len 초과 시 줄 단위로 분할해 반환."""
    if len(text) <= max_len:
        return [text]

    parts: list[str] = []
    current_lines: list[str] = []
    current_len = 0

    for line in text.splitlines(keepends=True):
        if current_len + len(line) > max_len and current_lines:
            parts.append("".join(current_lines))
            current_lines = []
            current_len = 0
        current_lines.append(line)
        current_len += len(line)

    if current_lines:
        parts.append("".join(current_lines))

    return parts


def parse_story_file(path: Path) -> Iterator[dict[str, str]]:
    """
    스토리 지플릿 파일을 파싱해 admin_blocks 레코드 dict를 yield.

    전략:
    1. BRIDGE_POSSIBLE_PERSON_TEMPLATE 전체를 하나의 레코드로 삽입.
    2. BRIDGE_SUCCESS_PERSON_TEMPLATE 전체를 하나의 레코드로 삽입.
    3. 각 사람별 실제 스토리 블록(이름: XXX 기준)을 개별 레코드로 삽입.
       - 블록이 MAX_CONTENT_LEN 초과 시 파트별로 분할.
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    total = len(lines)

    # ── 1. 두 템플릿 섹션 경계 검출 ──────────────────
    tmpl_possible_start: int | None = None
    tmpl_success_start: int | None = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if "[BRIDGE_POSSIBLE_PERSON_TEMPLATE]" in stripped and tmpl_possible_start is None:
            tmpl_possible_start = i
        if "[BRIDGE_SUCCESS_PERSON_TEMPLATE]" in stripped and tmpl_success_start is None:
            tmpl_success_start = i

    # 템플릿 경계: 다음 템플릿 시작 전까지 or 파일 끝까지
    boundaries: list[tuple[int, int]] = []
    if tmpl_possible_start is not None:
        end = tmpl_success_start if tmpl_success_start is not None else total
        boundaries.append((tmpl_possible_start, end))
    if tmpl_success_start is not None:
        boundaries.append((tmpl_success_start, total))

    yielded_templates: set[str] = set()

    for start, end in boundaries:
        block_lines = lines[start:end]
        # 블록 내 첫 줄로 카테고리 태그 결정
        header = block_lines[0].strip() if block_lines else ""
        if "BRIDGE_POSSIBLE_PERSON_TEMPLATE" in header:
            tag = "BRIDGE_POSSIBLE_PERSON"
            title_prefix = "[템플릿] 브릿지 가능성 인물 (Possible Person)"
        else:
            tag = "BRIDGE_SUCCESS_PERSON"
            title_prefix = "[템플릿] 브릿지 성공 인물 (Success Person)"

        if tag in yielded_templates:
            continue
        yielded_templates.add(tag)

        content = _clean("\n".join(block_lines))
        if not content:
            continue

        for idx, part in enumerate(_split_by_len(content)):
            if not _clean(part):
                continue
            title = title_prefix if idx == 0 else f"{title_prefix} (파트 {idx + 1})"
            yield {"title": title, "category": "story_template", "content": _clean(part)}

    # ── 2. 사람별 실제 스토리 블록 파싱 ──────────────
    # "이름: XXX" 패턴이 등장하는 줄을 기점으로 블록 구분
    name_line_pattern = re.compile(r"^이름\s*:\s*(.+)$")

    blocks: list[tuple[str, int, int]] = []  # (name, start_line, end_line)
    for i, line in enumerate(lines):
        m = name_line_pattern.match(line.strip())
        if m:
            name = m.group(1).strip()
            if blocks:
                # 이전 블록의 끝 갱신
                prev_name, prev_start, _ = blocks[-1]
                blocks[-1] = (prev_name, prev_start, i)
            blocks.append((name, i, total))

    for name, start, end in blocks:
        block_lines = lines[start:end]
        content = _clean("\n".join(block_lines))
        if not content:
            continue

        for idx, part in enumerate(_split_by_len(content)):
            if not _clean(part):
                continue
            title = f"스토리: {name}" if idx == 0 else f"스토리: {name} (파트 {idx + 1})"
            yield {"title": title, "category": "story_template", "content": _clean(part)}


def parse_schedule_file(path: Path) -> Iterator[dict[str, str]]:
    """
    일정관리 지플릿 파일을 파싱해 admin_blocks 레코드 dict를 yield.

    섹션 헤더(숫자. 로 시작)로 분리해 각 섹션을 개별 레코드로 삽입.
    """
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()

    # 섹션 헤더: "1. 목적", "2. 기본 원칙" 등
    section_header_pattern = re.compile(r"^\d+\.\s+.+")

    sections: list[tuple[str, list[str]]] = []  # (header, lines)
    preamble: list[str] = []
    current_header: str | None = None
    current_lines: list[str] = []

    for line in lines:
        if section_header_pattern.match(line.strip()):
            if current_header is not None:
                sections.append((current_header, current_lines))
            elif current_lines:
                preamble = current_lines[:]
            current_header = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

    # 마지막 섹션 저장
    if current_header is not None:
        sections.append((current_header, current_lines))
    elif current_lines:
        preamble.extend(current_lines)

    # 프리앰블(섹션 헤더 이전 내용) 전체를 하나의 레코드로
    if preamble:
        content = _clean("\n".join(preamble))
        if content:
            yield {
                "title": "일정관리 지플릿 운영 기준 — 개요",
                "category": "schedule",
                "content": content,
            }

    # 각 섹션별 레코드
    for header, sec_lines in sections:
        content = _clean(header + "\n" + "\n".join(sec_lines))
        if not content:
            continue

        for idx, part in enumerate(_split_by_len(content)):
            if not _clean(part):
                continue
            title = f"일정관리 지플릿 운영 기준 — {header}"
            if idx > 0:
                title += f" (파트 {idx + 1})"
            yield {"title": title, "category": "schedule", "content": _clean(part)}


# ──────────────────────────────────────────────
# Supabase 삽입
# ──────────────────────────────────────────────

def insert_record(client: httpx.Client, record: dict[str, str]) -> bool:
    """단일 레코드를 admin_blocks에 POST. 성공 시 True 반환."""
    resp = client.post(ENDPOINT, json=record, headers=HEADERS)
    if resp.status_code in (200, 201):
        return True
    # 204 No Content (Prefer: return=minimal)
    if resp.status_code == 204:
        return True
    print(f"  [ERROR] {resp.status_code}: {resp.text[:200]}", file=sys.stderr)
    return False


def existing_titles(client: httpx.Client, category: str) -> set[str]:
    """이미 삽입된 title 목록을 반환해 중복 삽입 방지."""
    resp = client.get(
        ENDPOINT,
        params={"category": f"eq.{category}", "select": "title"},
        headers=HEADERS,
    )
    if resp.status_code != 200:
        return set()
    return {row["title"] for row in resp.json()}


def run() -> None:
    total_inserted = 0
    total_skipped = 0

    with httpx.Client(timeout=30) as client:
        # ── 1. 스토리 지플릿 삽입 ──
        print("=" * 60)
        print("1. 스토리 지플릿 → admin_blocks (category=story_template)")
        print("=" * 60)

        existing_story = existing_titles(client, "story_template")
        story_inserted = 0
        story_skipped = 0

        for record in parse_story_file(STORY_FILE):
            if record["title"] in existing_story:
                print(f"  [SKIP] 이미 존재: {record['title'][:60]}")
                story_skipped += 1
                continue
            ok = insert_record(client, record)
            if ok:
                print(f"  [OK]   {record['title'][:70]}")
                story_inserted += 1
            time.sleep(0.05)  # rate limit 방지

        print(f"\n  스토리 삽입: {story_inserted}건 / 스킵: {story_skipped}건\n")
        total_inserted += story_inserted
        total_skipped += story_skipped

        # ── 2. 일정관리 지플릿 삽입 ──
        print("=" * 60)
        print("2. 일정관리 지플릿 → admin_blocks (category=schedule)")
        print("=" * 60)

        existing_schedule = existing_titles(client, "schedule")
        schedule_inserted = 0
        schedule_skipped = 0

        for record in parse_schedule_file(SCHEDULE_FILE):
            if record["title"] in existing_schedule:
                print(f"  [SKIP] 이미 존재: {record['title'][:60]}")
                schedule_skipped += 1
                continue
            ok = insert_record(client, record)
            if ok:
                print(f"  [OK]   {record['title'][:70]}")
                schedule_inserted += 1
            time.sleep(0.05)

        print(f"\n  일정관리 삽입: {schedule_inserted}건 / 스킵: {schedule_skipped}건\n")
        total_inserted += schedule_inserted
        total_skipped += schedule_skipped

    print("=" * 60)
    print(f"완료 — 총 삽입: {total_inserted}건 / 총 스킵: {total_skipped}건")
    print("=" * 60)


if __name__ == "__main__":
    run()
