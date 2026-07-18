import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: "오디오 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // Forward to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audio, "recording.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "ko");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        {
          error:
            errorData?.error?.message ?? "음성 인식에 실패했습니다",
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch {
    return NextResponse.json(
      { error: "음성 인식 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
