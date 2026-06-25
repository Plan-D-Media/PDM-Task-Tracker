"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_META, TASK_TYPE_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AssigneeAvatar, DueBadge, TypeIcon } from "./task-bits";
import type { BoardData } from "@/lib/queries/board-data";

export function TableView({
  data,
  onOpenTask,
}: {
  data: BoardData;
  onOpenTask: (taskId: string) => void;
}) {
  const colById = useMemo(
    () => new Map(data.columns.map((c) => [c.id, c])),
    [data.columns],
  );

  // Order: by column position, then task position.
  const rows = useMemo(() => {
    const colPos = new Map(data.columns.map((c) => [c.id, c.position]));
    return [...data.tasks].sort((a, b) => {
      const c = (colPos.get(a.column_id) ?? 0) - (colPos.get(b.column_id) ?? 0);
      return c !== 0 ? c : a.position - b.position;
    });
  }, [data.tasks, data.columns]);

  return (
    <div className="h-full overflow-auto px-4 pb-6">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-[var(--background)]">
          <tr className="text-left text-xs text-[var(--muted-foreground)]">
            <Th className="w-[40%]">Task</Th>
            <Th>Status</Th>
            <Th>Type</Th>
            <Th>Priority</Th>
            <Th>Assignee</Th>
            <Th>Due</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => {
            const col = colById.get(task.column_id);
            const done = !!col?.is_done_column;
            const cancelled = !!col?.is_cancelled_column;
            return (
              <tr
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="cursor-pointer hover:bg-[var(--muted)]/50"
              >
                <Td>
                  <span
                    className={cn(
                      "font-medium",
                      cancelled && "text-[var(--muted-foreground)] line-through",
                    )}
                  >
                    {task.title}
                  </span>
                </Td>
                <Td>
                  {col && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      {col.name}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
                    <TypeIcon type={task.task_type} />
                    {TASK_TYPE_META[task.task_type].label}
                  </span>
                </Td>
                <Td>
                  <Badge
                    variant="outline"
                    style={{ color: PRIORITY_META[task.priority].color }}
                  >
                    {PRIORITY_META[task.priority].label}
                  </Badge>
                </Td>
                <Td>
                  <AssigneeAvatar user={task.assignee} />
                </Td>
                <Td>
                  <DueBadge due={task.due_date} done={done || cancelled} />
                </Td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={6}
                className="py-12 text-center text-sm text-[var(--muted-foreground)]"
              >
                No tasks on this board yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-[var(--border)] px-3 py-2 font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-[var(--border)] px-3 py-2.5 align-middle">
      {children}
    </td>
  );
}
