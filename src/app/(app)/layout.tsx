import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { HouseholdProvider } from "@/features/household/store";
import { NewTaskDialog } from "@/features/tasks/new-task-dialog";
import { TaskDetailSheet } from "@/features/tasks/task-detail-sheet";
import { TaskUiProvider } from "@/features/tasks/task-ui-context";
import { loadSnapshot } from "@/lib/data/snapshot";
import { requirePageContext } from "@/server/context";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext();
  if (!ctx.household.onboarding_completed && ctx.isAdmin) redirect("/onboarding");

  const snapshot = await loadSnapshot(ctx.supabase, ctx.household.id, ctx.member.id);

  return (
    <HouseholdProvider initial={snapshot}>
      <TaskUiProvider>
        <AppShell>{children}</AppShell>
        <TaskDetailSheet />
        <NewTaskDialog />
      </TaskUiProvider>
    </HouseholdProvider>
  );
}
