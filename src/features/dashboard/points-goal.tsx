"use client";

import { PartyPopper } from "lucide-react";
import { Progress } from "@/components/ui/misc";
import type { Snapshot } from "@/lib/data/snapshot";

/** Optioneel gezinsdoel: "Bij 100 gezamenlijke punten → filmavond". Positief, nooit bestraffend. */
export function PointsGoal({ snapshot, since }: { snapshot: Snapshot; since: string }) {
  const { household } = snapshot;
  if (!household.points_enabled || !household.points_goal) return null;
  const points = snapshot.completions.filter((c) => c.completed_at >= since).reduce((sum, c) => sum + c.points, 0);
  const reached = points >= household.points_goal;

  return (
    <div className="grid gap-2 rounded-2xl border bg-gradient-to-br from-accent to-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <PartyPopper className="size-4 text-primary" />
        {reached ? "Doel gehaald! " : "Samen sparen voor: "}
        <span className="text-accent-foreground">{household.points_goal_reward ?? "een beloning"}</span>
      </p>
      <Progress value={points / household.points_goal} />
      <p className="text-xs text-muted-foreground">
        {points} van {household.points_goal} punten deze maand
      </p>
    </div>
  );
}
