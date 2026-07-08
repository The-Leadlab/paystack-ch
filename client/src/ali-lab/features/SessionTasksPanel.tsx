import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabFeatureText } from "../hooks/useLabFeatureText";
import type { LabSessionTask } from "../types";
import { labCollections } from "../aliLabFirestore";
import { useAliLabPersist } from "../hooks/useAliLabPersist";
import { useLinkedLedger } from "@/cafe/hooks/useLinkedLedger";
import { usePersonalPlan } from "../personal-plan/context/PersonalPlanContext";
import { GlassCard } from "../personal-plan/components/GlassCard";
import type { Session } from "@/cafe/types";

function sessionProgress(tasks: LabSessionTask[]) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, pct };
}

function SessionPicker({
  sessions,
  onSelect,
}: {
  sessions: Session[];
  onSelect: (session: Session) => void;
}) {
  if (sessions.length === 0) {
    return (
      <GlassCard className="p-6 text-center space-y-2">
        <p className="text-sm text-[var(--pp-on-surface-variant)]">No sessions yet.</p>
        <p className="text-xs text-[var(--pp-on-surface-variant)]">
          Create a session in Business first, then return here to manage your personal checklist.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelect(session)}
          className="text-left pp-glass-panel rounded-xl p-4 border border-[var(--pp-outline-variant)] hover:border-[var(--pp-primary)]/50 transition-colors"
        >
          <p className="text-sm font-semibold text-[var(--pp-on-surface)]">{session.name}</p>
          <p className="text-[11px] text-[var(--pp-on-surface-variant)] mt-1">Open session checklist</p>
        </button>
      ))}
    </div>
  );
}

export function SessionTasksPanel({ feature }: { feature: AliLabFeature }) {
  const { summary } = useLabFeatureText(feature);
  const { month } = usePersonalPlan();
  const ledger = useLinkedLedger(month);
  const { items: allTasks, add, update, remove, loading } = useAliLabPersist<LabSessionTask>(
    labCollections.sessionTasks,
    "session-tasks",
    []
  );

  const [draft, setDraft] = useState("");
  const activeSession = ledger.isAllSessionsView ? null : ledger.currentSession;

  const sessionTasks = useMemo(() => {
    if (!activeSession) return [];
    return allTasks
      .filter((t) => t.sessionId === activeSession.id)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }, [allTasks, activeSession]);

  const progress = sessionProgress(sessionTasks);

  const enterSession = (session: Session) => {
    ledger.setAllSessionsView(false);
    ledger.setCurrentSession(session);
  };

  const addTask = () => {
    if (!activeSession || !draft.trim()) return;
    void add({
      sessionId: activeSession.id,
      label: draft.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    });
    setDraft("");
  };

  return (
    <div className="space-y-6">
      <section>
        <span className="text-[var(--pp-primary)] text-xs font-semibold uppercase tracking-[0.2em]">
          Session checklist
        </span>
        <h2 className="text-2xl md:text-3xl font-bold mt-2">Personal session tasks</h2>
        <p className="text-sm text-[var(--pp-on-surface-variant)] mt-2 max-w-2xl">{summary}</p>
      </section>

      {!activeSession ? (
        <section className="space-y-4">
          <GlassCard className="p-4 flex items-start gap-3">
            <ListChecks className="size-5 text-[var(--pp-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Choose a session to open</p>
              <p className="text-xs text-[var(--pp-on-surface-variant)] mt-1">
                Pick the session you want to work in. Your task list and progress are saved per session.
              </p>
            </div>
          </GlassCard>
          <SessionPicker sessions={ledger.sessions} onSelect={enterSession} />
        </section>
      ) : (
        <>
          <GlassCard className="p-4 md:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[var(--pp-on-surface-variant)]">
                  Active session
                </p>
                <p className="text-lg font-semibold text-[var(--pp-primary)]">{activeSession.name}</p>
              </div>
              <button
                type="button"
                onClick={() => ledger.setAllSessionsView(true)}
                className="text-xs font-semibold text-[var(--pp-on-surface-variant)] underline hover:text-[var(--pp-on-surface)]"
              >
                Switch session
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--pp-on-surface-variant)]">
                <span>
                  {progress.done} of {progress.total} complete
                </span>
                <span className="font-semibold text-[var(--pp-secondary)]">{progress.pct}%</span>
              </div>
              <div className="pp-progress-track h-2">
                <div
                  className="h-full bg-[var(--pp-secondary)] transition-all duration-500 rounded-full"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-wrap gap-2">
            <input
              className="pp-input flex-1 min-w-[200px] px-3 py-2 text-sm"
              placeholder="Add a task…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
              }}
            />
            <button
              type="button"
              onClick={addTask}
              disabled={!draft.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--pp-primary-container)] text-[var(--pp-on-primary-container)] text-xs font-bold disabled:opacity-40"
            >
              <Plus className="size-4" />
              Add task
            </button>
          </GlassCard>

          <ul className="space-y-2">
            {loading && sessionTasks.length === 0 ? (
              <li className="text-sm text-[var(--pp-on-surface-variant)]">Loading tasks…</li>
            ) : null}
            {!loading && sessionTasks.length === 0 ? (
              <GlassCard className="p-6 text-center text-sm text-[var(--pp-on-surface-variant)]">
                No tasks yet — add your first item above.
              </GlassCard>
            ) : null}
            {sessionTasks.map((task) => (
              <li key={task.id}>
                <GlassCard className="p-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void update(task.id, { done: !task.done })}
                    className="shrink-0 text-[var(--pp-primary)]"
                    aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                  >
                    {task.done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                  </button>
                  <span
                    className={`flex-1 text-sm ${task.done ? "line-through text-[var(--pp-on-surface-variant)]" : "text-[var(--pp-on-surface)]"}`}
                  >
                    {task.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(task.id)}
                    className="shrink-0 p-1.5 rounded-md text-[var(--pp-on-surface-variant)] hover:text-[var(--pp-error)] hover:bg-[var(--pp-surface-high)]"
                    aria-label="Remove task"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </GlassCard>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
