"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Users, CreditCard, MessageSquare, Archive, Users2, ClipboardList, CalendarCheck } from "lucide-react";

interface Stats {
  totalUsers: number;
  paidUsers: number;
  totalConversations: number;
  totalArchives: number;
  totalContacts: number;
  totalConsultations: number;
  activeSchedules: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setStats(data);
      setLoading(false);
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      label: "전체 사용자",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      description: "가입된 전체 사용자 수",
    },
    {
      label: "유료 사용자",
      value: stats?.paidUsers ?? 0,
      icon: CreditCard,
      description: "유료 구독 중인 사용자",
    },
    {
      label: "전체 대화",
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      description: "생성된 전체 대화 수",
    },
    {
      label: "전체 아카이브",
      value: stats?.totalArchives ?? 0,
      icon: Archive,
      description: "저장된 전체 아카이브 수",
    },
  ];

  const teamStatCards = [
    {
      label: "전체 회원",
      value: stats?.totalContacts ?? 0,
      icon: Users2,
      description: "등록된 전체 회원 수",
    },
    {
      label: "전체 상담기록",
      value: stats?.totalConsultations ?? 0,
      icon: ClipboardList,
      description: "기록된 전체 상담 수",
    },
    {
      label: "진행중 일정",
      value: stats?.activeSchedules ?? 0,
      icon: CalendarCheck,
      description: "완료되지 않은 일정 수",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">대시보드</h1>
        <p className="text-sm text-foreground-secondary mt-1">지니아 서비스 현황을 확인합니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                    {card.label}
                  </span>
                  <div className="rounded-lg bg-primary-subtle p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-foreground-secondary mt-1">{card.description}</p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground-secondary uppercase tracking-wide mb-3">팀 통계</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {teamStatCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground-secondary uppercase tracking-wide">
                      {card.label}
                    </span>
                    <div className="rounded-lg bg-primary-subtle p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{card.value.toLocaleString()}</p>
                    <p className="text-xs text-foreground-secondary mt-1">{card.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
