import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { MAX_FILE_SIZE } from "@/lib/constants";

const ALLOWED_EXTENSIONS = ["pdf", "txt", "xlsx", "jpg", "jpeg", "png"];
const PARSEABLE_EXTENSIONS = ["pdf", "txt", "xlsx"];

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Storage 업로드는 RLS 우회를 위해 서비스 롤 클라이언트 사용 (인증은 위에서 완료)
    const serviceSupabase = createServiceClient();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "파일이 필요합니다" },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기는 10MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const filePath = `${user.id}/${timestamp}_${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await serviceSupabase.storage
      .from("attachments")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `파일 업로드 실패: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Parse content for text-based files
    let content: string | undefined;

    if (PARSEABLE_EXTENSIONS.includes(ext)) {
      try {
        if (ext === "txt") {
          content = await file.text();
        } else if (ext === "pdf") {
          // Cloudflare Workers do not provide the DOM canvas primitives used by
          // pdf-parse. Keep the uploaded file available and defer extraction.
          content = undefined;
        } else if (ext === "xlsx") {
          const XLSX = await import("xlsx");
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: "array" });
          const sheets: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            sheets.push(`[${sheetName}]\n${csv}`);
          }
          content = sheets.join("\n\n");
        }
      } catch {
        // If parsing fails, continue without content
      }
    }

    const result: Record<string, unknown> = {
      file_path: filePath,
      file_name: file.name,
      file_type: ext,
      file_size: file.size,
    };

    if (content !== undefined) {
      result.content = content;
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "파일 업로드 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
