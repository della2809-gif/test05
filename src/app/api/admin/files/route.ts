import { NextResponse, after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { MAX_FILE_SIZE } from "@/lib/constants";
import { createEmbedding } from "@/lib/rag";
import { assessReferenceTextQuality } from "@/lib/reference-quality";
import type { AdminFile, Profile } from "@/types/database";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, Math.min(start + CHUNK_SIZE, text.length)));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  return chunks;
}

const ADMIN_FILES_BUCKET = "admin-files";
const ALLOWED_EXTENSIONS = ["pdf", "txt", "xlsx"];
const FILE_LIST_COLUMNS = "id,file_name,file_type,file_size,category,keywords,is_active,created_at";
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized", status: 401, supabase: null };

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const profile = profileData as Pick<Profile, "role"> | null;

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", status: 403, supabase: null };
  }

  return { error: null, status: 200, supabase };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const profile = profileData as Pick<Profile, "role"> | null;

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const limitParam = Number(searchParams.get("limit") ?? DEFAULT_LIST_LIMIT);
    const offsetParam = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), MAX_LIST_LIMIT)
      : DEFAULT_LIST_LIMIT;
    const offset = Number.isFinite(offsetParam) ? Math.max(Math.floor(offsetParam), 0) : 0;

    let query = supabase
      .from("admin_files")
      .select(FILE_LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike("file_name", `%${search}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const [filesResult, categoriesResult] = await Promise.all([
      query,
      supabase
        .from("admin_files")
        .select("category")
        .not("category", "is", null)
        .order("category", { ascending: true }),
    ]);

    const { data, error, count } = filesResult;

    if (error) {
      return NextResponse.json(
        { error: "파일 목록을 불러오지 못했습니다." },
        { status: 500 }
      );
    }

    const categories = Array.from(
      new Set(
        ((categoriesResult.data as { category: string | null }[] | null) ?? [])
          .map((item) => item.category)
          .filter((item): item is string => !!item)
      )
    );

    return NextResponse.json({
      files: data ?? [],
      categories,
      total: count ?? 0,
      limit,
      offset,
      hasMore: offset + limit < (count ?? 0),
    });
  } catch {
    return NextResponse.json(
      { error: "파일 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error: authError, status: authStatus } = await requireAdmin();

    if (authError) {
      return NextResponse.json({ error: authError }, { status: authStatus });
    }
    // Storage·DB 작업은 서비스 롤 클라이언트로 RLS 우회 (어드민 인증은 위에서 완료)
    const supabase = createServiceClient();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formErr) {
      console.error("[admin/files] formData parse error:", formErr);
      return NextResponse.json(
        { error: "파일 파싱 실패: 파일이 너무 크거나 요청이 잘못되었습니다. (최대 4.5MB)" },
        { status: 400 }
      );
    }
    const file = formData.get("file");
    const description = (formData.get("description") as string | null)?.trim() || null;
    const category = (formData.get("category") as string | null)?.trim() || null;
    const keywords = (formData.get("keywords") as string | null)?.trim() || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (PDF, TXT, XLSX만 허용)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 10MB 이하여야 합니다." },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    // 한글 등 non-ASCII 파일명은 Supabase Storage "Invalid key" 오류 발생
    // → 확장자만 유지하고 타임스탬프로 된 ASCII 안전 경로 사용
    const timestamp = Date.now();
    const filePath = `${timestamp}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const MIME_TYPE_MAP: Record<string, string> = {
      pdf: "application/pdf",
      txt: "text/plain",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const contentType = MIME_TYPE_MAP[ext] ?? file.type ?? "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(ADMIN_FILES_BUCKET)
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `파일 업로드 실패: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // txt는 동기적으로 파싱 (worker 불필요)
    let txtContent: string | null = null;
    if (ext === "txt") {
      try {
        txtContent = buffer.toString("utf-8");
      } catch {
        // non-fatal
      }
    }

    // xlsx는 동기적으로 파싱 (worker 불필요)
    let xlsxContent: string | null = null;
    if (ext === "xlsx") {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheets: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheets.push(`[${sheetName}]\n${csv}`);
        }
        xlsxContent = sheets.join("\n\n");
      } catch {
        // non-fatal
      }
    }

    const syncParsedContent = txtContent ?? xlsxContent;

    // Insert metadata into admin_files table
    const { data: recordData, error: insertError } = await supabase
      .from("admin_files")
      // @ts-expect-error -- Database type resolves Insert to never; runtime is correct
      .insert({
        file_name: file.name,
        file_path: filePath,
        file_type: ext,
        file_size: file.size,
        description: description ?? syncParsedContent,
        category,
        keywords,
      })
      .select()
      .single();
    const record = recordData as AdminFile | null;

    if (insertError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from(ADMIN_FILES_BUCKET).remove([filePath]);
      return NextResponse.json(
        { error: `메타데이터 저장 실패: ${insertError.message}` },
        { status: 500 }
      );
    }

    // PDF 파싱 + 임베딩은 응답 전송 후 백그라운드에서 실행
    // pdf-parse v2가 worker_threads를 사용해 Vercel에서 블로킹될 수 있으므로 after()로 분리
    if (record) {
      const recordId = record.id;
      try {
        after(async () => {
          try {
            console.log("[after] start, ext:", ext, "fileId:", recordId);
            let parsedContent: string | null = syncParsedContent;

            if (ext === "pdf") {
              // pdfjs-dist가 Node.js에 없는 브라우저 API를 초기화 시 사용함
              // → 스텁 폴리필로 에러 방지 (텍스트 추출에는 실제 canvas 값 불필요)
              console.log("[after] setting DOM polyfills, DOMMatrix defined:", typeof (globalThis as any).DOMMatrix);
              if (typeof (globalThis as any).DOMMatrix === "undefined") {
                (globalThis as any).DOMMatrix = class DOMMatrix {
                  a=1;b=0;c=0;d=1;e=0;f=0;
                  m11=1;m12=0;m13=0;m14=0;m21=0;m22=1;m23=0;m24=0;
                  m31=0;m32=0;m33=1;m34=0;m41=0;m42=0;m43=0;m44=1;
                  is2D=true;isIdentity=true;
                  scale() { return this; }
                  translate() { return this; }
                  multiply() { return this; }
                  inverse() { return this; }
                  transformPoint(p: unknown) { return p; }
                };
              }
              if (typeof (globalThis as any).ImageData === "undefined") {
                (globalThis as any).ImageData = class ImageData {
                  constructor(public data: Uint8Array, public width: number, public height: number) {}
                };
              }
              if (typeof (globalThis as any).Path2D === "undefined") {
                (globalThis as any).Path2D = class Path2D {};
              }

              console.warn(
                "[after] PDF text extraction is deferred on the Cloudflare runtime.",
              );
              return;
              if (!parsedContent) return;

              const quality = assessReferenceTextQuality(parsedContent, ext);
              if (!quality.ok) {
                console.warn("[after] skipped low-quality PDF extraction:", {
                  fileId: recordId,
                  reason: quality.reason,
                  metrics: quality.metrics,
                });
                if (!description) {
                  await (supabase as any).from("admin_files").update({
                    description: `[자동 추출 보류] ${quality.reason}`,
                  }).eq("id", recordId);
                }
                return;
              }

              // 사용자가 설명을 입력하지 않은 경우 품질 검사를 통과한 파싱 결과만 description으로 저장
              if (!description && parsedContent) {
                await (supabase as any).from("admin_files").update({
                  description: parsedContent!.slice(0, 1000),
                }).eq("id", recordId);
              }
            }

            if (!parsedContent) return;

            const quality = assessReferenceTextQuality(parsedContent, ext);
            if (!quality.ok) {
              console.warn("[after] skipped low-quality reference extraction:", {
                fileId: recordId,
                reason: quality.reason,
                metrics: quality.metrics,
              });
              return;
            }

            const chunks = splitIntoChunks(parsedContent);
            // 순차 처리(~20초)는 Vercel 10초 타임아웃 초과 → 병렬 처리로 전환(~2-3초)
            const embeddings = await Promise.all(chunks.map((c) => createEmbedding(c)));
            await Promise.all(chunks.map((chunk, i) =>
              (supabase as any).from("document_chunks").insert({
                source_type: "admin_files",
                source_id: recordId,
                source_name: file.name,
                chunk_text: chunk,
                embedding: JSON.stringify(embeddings[i]),
                // 병렬 insert라 created_at으로 원문 순서를 복원할 수 없다.
                // 본문 미리보기(GET /api/admin/files/[id])가 이 인덱스로 정렬한다.
                metadata: { chunk_index: i },
              })
            ));
          } catch (afterInnerErr) {
            console.error("[after] inner error:", afterInnerErr);
          }
        });
      } catch (afterErr) {
        // after() not available in this context — skip background processing
        console.warn("after() skipped:", afterErr);
      }
    }

    return NextResponse.json({ file: record }, { status: 201 });
  } catch (err) {
    console.error("[admin/files] unexpected error:", err);
    return NextResponse.json(
      { error: "파일 업로드 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
