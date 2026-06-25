"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { AssigneeAvatar, DueBadge, PriorityDot, TypeIcon } from "./task-bits";
import type { TaskWithAssignee } from "@/lib/queries/board-data";

/**
 * A draggable Kanban card. The whole card is the drag handle; an 8px
 * activation distance (set on the DndContext sensor) keeps plain clicks
 * working so `onOpen` still fires the detail sheet.
 */
export function TaskCard({
  task,
  done,
  cancelled,
  onOpen,
  overlay,
}: {
  task: TaskWithAssignee;
  done: boolean;
  cancelled: boolean;
  onOpen: () => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } });

  const style = overlay
    ? undefined
    : { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      onClick={onOpen}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={cn(
        "cursor-grab touch-none rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-2 cursor-grabbing shadow-xl",
      )}
    >
      <div className="flex items-start gap-2">
        <PriorityDot priority={task.priority} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <TypeIcon type={task.task_type} className="mt-0.5" />
            <span
              className={cn(
                "text-sm font-medium leading-snug",
                (done || cancelled) && "text-[var(--muted-foreground)]",
                cancelled && "line-through",
              )}
            >
              {task.title}
            </span>
          </div>
          {(task.due_date || task.assignee) && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <DueBadge due={task.due_date} done={done || cancelled} />
              <AssigneeAvatar user={task.assignee} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
