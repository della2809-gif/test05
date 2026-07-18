import { afterEach, describe, expect, it, vi } from "vitest";

import { searchReferenceDocuments } from "../rag";

describe("searchReferenceDocuments", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed when match_reference_documents RPC errors instead of falling back to unfiltered admin_files search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ data: [{ embedding: Array.from({ length: 1536 }, () => 0.01) }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const supabase = {
      rpc: vi.fn(async (name: string) => {
        if (name === "match_reference_documents") {
          return { data: null, error: { message: "RPC unavailable" } };
        }
        if (name === "match_documents_by_source") {
          return {
            data: [
              {
                source_name: "inactive-reference.txt",
                chunk_text: "비활성 레퍼런스 누출 후보",
                metadata: null,
              },
            ],
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${name}`);
      }),
    };

    const results = await searchReferenceDocuments("레퍼런스 비활성 테스트", supabase as never);

    expect(results).toEqual([]);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "match_reference_documents",
      expect.objectContaining({ match_threshold: 0.3, match_count: 6 })
    );
  });
});
