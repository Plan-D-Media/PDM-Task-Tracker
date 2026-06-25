"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useReorderTasks, type BoardData } from "@/lib/queries/board-data";
import { KanbanColumn } from "./kanban-column";
import { AddColumnDialog } from "./add-column-dialog";
import { TaskCard } from "./task-card";

export function Kanban({
  boardId,
  data,
  onOpenTask,
}: {
  boardId: string;
  data: BoardData;
  onOpenTask: (taskId: string) => void;
}) {
  const reorder = useReorderTasks(boardId);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Tasks grouped by column, each list ordered by position.
  const groups = useMemo(() => {
    const map = new Map<string, typeof data.tasks>();
    for (const col of data.columns) map.set(col.id, []);
    for (const t of [...data.tasks].sort((a, b) => a.position - b.position)) {
      (map.get(t.column_id) ?? map.set(t.column_id, []).get(t.column_id)!).push(t);
    }
    return map;
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeTask = activeId
    ? data.tasks.find((t) => t.id === activeId) ?? null
    : null;
  const activeColumn = activeTask
    ? data.columns.find((c) => c.id === activeTask.column_id)
    : undefined;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeTaskId = String(active.id);
    const dragged = data.tasks.find((t) => t.id === activeTaskId);
    if (!dragged) return;

    const overType = over.data.current?.type;
    const toCol =
      overType === "column"
        ? String(over.data.current?.columnId)
        : (data.tasks.find((t) => t.id === String(over.id))?.column_id ?? null);
    if (!toCol) return;

    const fromCol = dragged.column_id;

    let updates: { id: string; column_id: string; position: number }[];

    if (fromCol === toCol) {
      const ids = (groups.get(toCol) ?? []).map((t) => t.id);
      const oldIndex = ids.indexOf(activeTaskId);
      const newIndex =
        overType === "column"
          ? ids.length - 1
          : ids.indexOf(String(over.id));
      if (oldIndex === newIndex || newIndex < 0) return;
      updates = arrayMove(ids, oldIndex, newIndex).map((id, i) => ({
        id,
        column_id: toCol,
        position: i,
      }));
    } else {
      const targetIds = (groups.get(toCol) ?? []).map((t) => t.id);
      const insertAt =
        overType === "column"
          ? targetIds.length
          : Math.max(0, targetIds.indexOf(String(over.id)));
      targetIds.splice(insertAt, 0, activeTaskId);
      updates = targetIds.map((id, i) => ({
        id,
        column_id: toCol,
        position: i,
      }));
    }

    reorder.mutate(updates);
  }

  const nextPosition =
    data.columns.reduce((max, c) => Math.max(max, c.position), -1) + 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto px-4 pb-4">
        {data.columns
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((column) => (
            <KanbanColumn
              key={column.id}
              boardId={boardId}
              column={column}
              tasks={groups.get(column.id) ?? []}
              onOpenTask={onOpenTask}
            />
          ))}
        <AddColumnDialog boardId={boardId} nextPosition={nextPosition} />
      </div>

      <DragOverlay>
        {activeTask && activeColumn ? (
          <TaskCard
            task={activeTask}
            done={activeColumn.is_done_column}
            cancelled={activeColumn.is_cancelled_column}
            onOpen={() => {}}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
