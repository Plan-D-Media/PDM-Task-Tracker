"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useCreateTask,
  useDeleteColumn,
  useUpdateColumn,
} from "@/lib/queries/board-data";
import { TaskCard } from "./task-card";
import type { BoardColumn } from "@/lib/database.types";
import type { TaskWithAssignee } from "@/lib/queries/board-data";

export function KanbanColumn({
  boardId,
  column,
  tasks,
  onOpenTask,
}: {
  boardId: string;
  column: BoardColumn;
  tasks: TaskWithAssignee[];
  onOpenTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const canonical = column.is_done_column || column.is_cancelled_column;
  const updateColumn = useUpdateColumn(boardId);
  const deleteColumn = useDeleteColumn(boardId);

  function rename() {
    const name = window.prompt("Rename column", column.name)?.trim();
    if (name && name !== column.name) {
      updateColumn.mutate({ columnId: column.id, patch: { name } });
    }
  }

  function remove() {
    if (tasks.length > 0) {
      toast.error("Move or archive its tasks before deleting this column.");
      return;
    }
    if (window.confirm(`Delete the “${column.name}” column?`)) {
      deleteColumn.mutate(column.id, {
        onError: (e) => toast.error((e as Error).message),
      });
    }
  }

  return (
    <div className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-[var(--muted)]/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: column.color }}
        />
        <span className="text-sm font-semibold">{column.name}</span>
        <span className="rounded-full bg-[var(--card)] px-1.5 text-xs font-medium text-[var(--muted-foreground)]">
          {tasks.length}
        </span>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              aria-label="Column actions"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={rename}>
                <Pencil /> Rename
              </DropdownMenuItem>
              {!canonical && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onClick={remove}>
                    <Trash2 /> Delete column
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-[var(--accent)]/50",
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              done={column.is_done_column}
              cancelled={column.is_cancelled_column}
              onOpen={() => onOpenTask(task.id)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <p className="px-1 py-3 text-center text-xs text-[var(--muted-foreground)]">
            No tasks
          </p>
        )}
      </div>

      <AddTaskInline boardId={boardId} columnId={column.id} />
    </div>
  );
}

function AddTaskInline({
  boardId,
  columnId,
}: {
  boardId: string;
  columnId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const createTask = useCreateTask(boardId);

  function submit() {
    const t = title.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    createTask.mutate(
      { columnId, title: t },
      { onError: (e) => toast.error((e as Error).message) },
    );
    setTitle("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="m-2 mt-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--card)] hover:text-[var(--foreground)]"
      >
        <Plus className="size-4" /> Add task
      </button>
    );
  }

  return (
    <div className="p-2 pt-0">
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
        placeholder="Task title…"
        rows={2}
        className="w-full resize-none rounded-lg border border-[var(--input)] bg-[var(--card)] p-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />
    </div>
  );
}
