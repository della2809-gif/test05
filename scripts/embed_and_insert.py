"""
embed_and_insert.py

Supabase DB에서 admin_blocks와 faqs 데이터를 가져와
OpenAI text-embedding-3-small 임베딩을 생성하고
document_chunks 테이블에 삽입한다.
"""

import json
import os
import time
import sys
from typing import Any, Dict, List, Optional

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not all((SUPABASE_URL, SUPABASE_KEY, OPENAI_API_KEY)):
    raise RuntimeError(
        "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY are required"
    )
EMBEDDING_MODEL = "text-embedding-3-small"
MAX_TEXT_LEN = 8000
SLEEP_BETWEEN = 0.3  # seconds

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

OPENAI_HEADERS = {
    "Authorization": f"Bearer {OPENAI_API_KEY}",
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_supabase(path: str, params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """Supabase REST API에서 레코드 목록을 가져온다."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    resp = requests.get(url, headers=SUPABASE_HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_embedding(text: str) -> Optional[List[float]]:
    """OpenAI Embeddings API로 임베딩 벡터를 반환한다. 실패 시 None."""
    truncated = text[:MAX_TEXT_LEN]
    payload = {"model": EMBEDDING_MODEL, "input": truncated}
    try:
        resp = requests.post(
            "https://api.openai.com/v1/embeddings",
            headers=OPENAI_HEADERS,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception as exc:
        print(f"  [WARN] 임베딩 생성 실패: {exc}", file=sys.stderr)
        return None


def insert_chunk(
    source_type: str,
    source_id: str,
    source_name: str,
    chunk_text: str,
    embedding: list[float],
) -> bool:
    """document_chunks 테이블에 단일 레코드를 삽입한다. 성공 시 True."""
    url = f"{SUPABASE_URL}/rest/v1/document_chunks"
    headers = {**SUPABASE_HEADERS, "Prefer": "return=minimal"}
    body = {
        "source_type": source_type,
        "source_id": str(source_id),
        "source_name": source_name,
        "chunk_text": chunk_text,
        "embedding": json.dumps(embedding),
    }
    try:
        resp = requests.post(url, headers=headers, json=body, timeout=30)
        resp.raise_for_status()
        return True
    except Exception as exc:
        print(f"  [WARN] 삽입 실패 (source_id={source_id}): {exc}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process_admin_blocks() -> int:
    """admin_blocks 처리 후 삽입 건수 반환."""
    print("\n[1/2] admin_blocks 데이터 가져오는 중...")
    records = fetch_supabase(
        "admin_blocks",
        params={"select": "id,title,category,content"},
    )
    total = len(records)
    print(f"  총 {total}건 조회됨")

    inserted = 0
    for idx, rec in enumerate(records, start=1):
        title = rec.get("title") or ""
        content = rec.get("content") or ""
        chunk_text = f"{title}\n{content}".strip()

        embedding = get_embedding(chunk_text)
        if embedding is None:
            print(f"  admin_blocks {idx}/{total} SKIP (임베딩 실패) — {title[:40]}")
            time.sleep(SLEEP_BETWEEN)
            continue

        ok = insert_chunk(
            source_type="admin_block",
            source_id=str(rec["id"]),
            source_name=title,
            chunk_text=chunk_text,
            embedding=embedding,
        )
        status = "완료" if ok else "삽입 실패"
        print(f"  admin_blocks {idx}/{total} {status} — {title[:40]}")
        if ok:
            inserted += 1
        time.sleep(SLEEP_BETWEEN)

    return inserted


def process_faqs() -> int:
    """faqs 처리 후 삽입 건수 반환."""
    print("\n[2/2] faqs 데이터 가져오는 중...")
    records = fetch_supabase(
        "faqs",
        params={"select": "id,question,answer,category", "is_active": "eq.true"},
    )
    total = len(records)
    print(f"  총 {total}건 조회됨")

    inserted = 0
    for idx, rec in enumerate(records, start=1):
        question = rec.get("question") or ""
        answer = rec.get("answer") or ""
        chunk_text = f"{question}\n{answer}".strip()

        embedding = get_embedding(chunk_text)
        if embedding is None:
            print(f"  faqs {idx}/{total} SKIP (임베딩 실패) — {question[:40]}")
            time.sleep(SLEEP_BETWEEN)
            continue

        ok = insert_chunk(
            source_type="faq",
            source_id=str(rec["id"]),
            source_name=question,
            chunk_text=chunk_text,
            embedding=embedding,
        )
        status = "완료" if ok else "삽입 실패"
        print(f"  faqs {idx}/{total} {status} — {question[:40]}")
        if ok:
            inserted += 1
        time.sleep(SLEEP_BETWEEN)

    return inserted


def main() -> None:
    print("=== embed_and_insert 시작 ===")
    blocks_inserted = process_admin_blocks()
    faqs_inserted = process_faqs()
    total_inserted = blocks_inserted + faqs_inserted
    print(f"\n=== 완료 ===")
    print(f"  admin_blocks 삽입: {blocks_inserted}건")
    print(f"  faqs 삽입:         {faqs_inserted}건")
    print(f"  총 삽입:           {total_inserted}건")


if __name__ == "__main__":
    main()
