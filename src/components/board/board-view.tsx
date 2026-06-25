"use client";

import { useState } from "react";
import { KanbanSquare, Loader2, Table2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBoardData } from "@/lib/queries/board-data";
import { Kanban } from "./kanban";
import { TableView } from "./table-view";
import { TaskSheet } from "./task-sheet";

export function BoardView({
  boardId,
  initialName,
}: {
  boardId: string;
  initialName: string;
}) {
  const { data, isLoading, isError, error } = useBoardData(boardId);
  const [view, setView] = useState<"board" | "table">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask =
    data?.tasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {data?.board.name ?? initialName}
          </h1>
          {data?.board.description && (
            <p className="truncate text-sm text-[var(--muted-foreground)]">
              {data.board.description}
            </p>
          )}
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
          <TabsList>
            <TabsTrigger value="board">
              <KanbanSquare /> Board
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table2 /> Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="min-h-0 flex-1 pt-4">
        {isLoading && (
          <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
        {isError && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--destructive)]">
            {(error as Error)?.message ?? "Could not load this board."}
          </div>
        )}
        {data &&
          (view === "board" ? (
            <Kanban boardId={boardId} data={data} onOpenTask={setSelectedTaskId} />
          ) : (
            <TableView data={data} onOpenTask={setSelectedTaskId} />
          ))}
      </div>

      <TaskSheet
        boardId={boardId}
        task={selectedTask}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
}
