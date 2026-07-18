import { HealthResult } from "@/components/health-check/health-result";

export default async function HealthReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HealthResult id={id} fullReport />;
}
