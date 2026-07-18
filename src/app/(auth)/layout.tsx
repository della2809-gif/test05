import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[400px] space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-foreground">GENI</span>
            <span className="text-primary">EA</span>
          </h1>
          <p className="mt-2 text-sm text-foreground-secondary">AI 기록 정리 서비스</p>
        </div>
        {children}
      </div>
    </div>
  );
}
