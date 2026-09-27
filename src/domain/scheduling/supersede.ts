/**
 * Voorkomt stapels verlopen taken: als een taak van een reeks verlopen is én
 * de volgende uitvoering van dezelfde reeks al beschikbaar is, wordt de oude
 * automatisch op "Overgeslagen" gezet (telt wel mee als "vergeten").
 * Voorbeeld: "Vaatwasser uitruimen" van maandag vervalt zodra die van dinsdag er is.
 */
export interface SupersedeCandidate {
  id: string;
  recurrenceId: string | null;
  occurrenceDate: string | null;
  status: string;
  dueAt: string | null;
  availableFrom: string | null;
  scheduledDate: string;
}

export function findSupersededTasks(tasks: SupersedeCandidate[], now: Date): string[] {
  const nowMs = now.getTime();
  const bySeries = new Map<string, SupersedeCandidate[]>();
  for (const task of tasks) {
    if (!task.recurrenceId) continue;
    const list = bySeries.get(task.recurrenceId) ?? [];
    list.push(task);
    bySeries.set(task.recurrenceId, list);
  }

  const superseded: string[] = [];
  for (const list of bySeries.values()) {
    const available = list.filter(
      (t) => (t.status === "todo" || t.status === "in_progress") &&
        (t.availableFrom === null || new Date(t.availableFrom).getTime() <= nowMs),
    );
    for (const task of available) {
      const overdue = task.dueAt !== null && new Date(task.dueAt).getTime() < nowMs;
      if (!overdue) continue;
      const key = task.occurrenceDate ?? task.scheduledDate;
      const newer = available.some((other) => other.id !== task.id && (other.occurrenceDate ?? other.scheduledDate) > key);
      if (newer) superseded.push(task.id);
    }
  }
  return superseded;
}
