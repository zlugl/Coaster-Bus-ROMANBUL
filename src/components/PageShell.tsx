import { AppNav } from "@/components/AppNav";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
  mainClassName,
}: {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      <AppNav />
      <main
        className={cn(
          "container mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:py-10 md:pb-10 safe-bottom",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
