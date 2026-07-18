import Link from "next/link";

export default function HealthReportMobilePreviewPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto mb-4 flex max-w-[430px] items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-emerald-700">MOBILE PREVIEW</p>
          <h1 className="mt-1 text-lg font-bold text-slate-950">진단 결과 보고서</h1>
        </div>
        <Link className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700" href="/health-report-preview">
          전체 화면
        </Link>
      </div>

      <div className="mx-auto h-[844px] w-full max-w-[390px] overflow-hidden rounded-[34px] border-[8px] border-slate-950 bg-white shadow-2xl">
        <iframe
          className="h-full w-full border-0"
          src="/health-report-preview"
          title="GENIEA 모바일 진단 결과 보고서 미리보기"
        />
      </div>
    </main>
  );
}
