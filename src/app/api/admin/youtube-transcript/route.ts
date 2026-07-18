import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// YouTube 자막 추출 함수 (공개 자막 API 사용)
async function fetchYoutubeTranscript(videoId: string): Promise<string | null> {
  try {
    // YouTube 페이지 HTML 가져오기
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!pageRes.ok) return null;

    const html = await pageRes.text();

    // 방법 1: ytInitialPlayerResponse에서 captions 파싱 (더 안정적)
    const playerResponseMatch = html.match(/"captions":\s*\{"playerCaptionsTracklistRenderer":\{"captionTracks":\s*(\[[\s\S]*?\])/);
    const legacyMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);

    const captionMatch = playerResponseMatch || legacyMatch;
    if (!captionMatch) return null;

    let captionTracks: Array<{ baseUrl: string; name: { simpleText: string }; languageCode: string }>;
    try {
      // baseUrl이 첫 번째로 끝나는 지점까지만 파싱 (중첩된 JSON 처리)
      let jsonStr = captionMatch[1];
      // 배열이 완성될 때까지만 추출
      let depth = 0;
      let endIdx = 0;
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '[') depth++;
        else if (jsonStr[i] === ']') {
          depth--;
          if (depth === 0) { endIdx = i; break; }
        }
      }
      if (endIdx > 0) jsonStr = jsonStr.slice(0, endIdx + 1);
      captionTracks = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    if (!Array.isArray(captionTracks) || captionTracks.length === 0) return null;

    // 한국어 우선, 없으면 영어, 없으면 첫 번째
    const track =
      captionTracks.find((t) => t.languageCode === "ko") ??
      captionTracks.find((t) => t.languageCode?.startsWith("ko")) ??
      captionTracks.find((t) => t.languageCode === "en") ??
      captionTracks[0];

    if (!track?.baseUrl) return null;

    // 자막 XML 다운로드
    const xmlRes = await fetch(track.baseUrl);
    if (!xmlRes.ok) return null;
    const xml = await xmlRes.text();

    // XML에서 텍스트 추출
    const textMatches = xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g);
    const lines: string[] = [];
    for (const match of textMatches) {
      const text = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/<[^>]+>/g, "")
        .trim();
      if (text) lines.push(text);
    }

    return lines.length > 0 ? lines.join(" ") : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { videoId, recordId } = await request.json();
  if (!videoId) return NextResponse.json({ error: "videoId가 필요합니다" }, { status: 400 });

  const transcript = await fetchYoutubeTranscript(videoId);
  if (!transcript) {
    return NextResponse.json(
      { error: "자막을 가져올 수 없습니다. 자막이 없는 영상이거나 비공개 영상일 수 있습니다." },
      { status: 422 }
    );
  }

  // DB 업데이트 (recordId가 있으면)
  if (recordId) {
    await (supabase.from("youtube_transcripts") as any)
      .update({ transcript, updated_at: new Date().toISOString() })
      .eq("id", recordId);
  }

  return NextResponse.json({ transcript, length: transcript.length });
}
