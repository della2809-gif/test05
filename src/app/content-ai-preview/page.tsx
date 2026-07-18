import type { Metadata } from "next";
import { ContentAiDashboard } from "@/components/content-ai/content-ai-dashboard";

export const metadata: Metadata = {
  title: "WELLSET Content AI 미리보기",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ContentAiPreviewPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-6 md:px-8 md:py-10">
      <ContentAiDashboard canSaveStrategy={false} />
    </main>
  );
}
