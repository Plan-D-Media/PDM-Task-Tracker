"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Board,
  BoardColumn,
  Profile,
  Task,
  TaskComment,
} from "@/lib/database.types";

export type AssigneeLite = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;
export type TaskWithAssignee = Task & { assignee: AssigneeLite | null };

export type BoardData = {
  board: Board;
  columns: BoardColumn[];
  tasks: TaskWithAssignee[];
};

export const boardKey = (boardId: string) => ["board", boardId] as const;

// ── Read: everything needed to render a board ────────────────────────
export function useBoardData(boardId: string) {
  return useQuery({
    queryKey: boardKey(boardId),
    queryFn: async (): Promise<BoardData> => {
      const supabase = createClient();
      const [board, columns, tasks] = await Promise.all([
        supabase.from("boards").select("*").eq("id", boardId).single(),
        supabase
          .from("board_columns")
          .select("*")
          .eq("board_id", boardId)
          .order("position", { ascending: true }),
        supabase
          .from("tasks")
          .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, email, avatar_url)")
          .eq("board_id", boardId)
          .is("archived_at", null)
          .order("position", { ascending: true }),
      ]);
      if (board.error) throw board.error;
      if (columns.error) throw columns.error;
      if (tasks.error) throw tasks.error;
      return {
        board: board.data as Board,
        columns: (columns.data ?? []) as BoardColumn[],
        tasks: (tasks.data ?? []) as unknown as TaskWithAssignee[],
      };
    },
  });
}

/** Active staff directory for assignee pickers (RLS lets any auth user read). */
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles", "active"],
    queryFn: async (): Promise<AssigneeLite[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AssigneeLite[];
    },
    staleTime: 5 * 60_000,
  });
}

function patchBoard(qc: QueryClient, boardId: string, fn: (d: BoardData) => BoardData) {
  qc.setQueryData<BoardData>(boardKey(boardId), (prev) => (prev ? fn(prev) : prev));
}

// ── Move a task to a column/position (optimistic, rollback on error) ──
export function useMoveTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { taskId: string; columnId: string; position: number }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({ column_id: vars.columnId, position: vars.position })
        .eq("id", vars.taskId);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: boardKey(boardId) });
      const prev = qc.getQueryData<BoardData>(boardKey(boardId));
      patchBoard(qc, boardId, (d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === vars.taskId
            ? { ...t, column_id: vars.columnId, position: vars.position }
            : t,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(boardId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

// ── Reorder / move tasks (handles within-column AND cross-column) ─────
// Callers pass the full new ordering for the affected column(s); each row
// gets its column_id + sequential position. Optimistic, rollback on error.
export function useReorderTasks(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; column_id: string; position: number }[]) => {
      const supabase = createClient();
      for (const u of updates) {
        const { error } = await supabase
          .from("tasks")
          .update({ column_id: u.column_id, position: u.position })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: boardKey(boardId) });
      const prev = qc.getQueryData<BoardData>(boardKey(boardId));
      const byId = new Map(updates.map((u) => [u.id, u]));
      patchBoard(qc, boardId, (d) => ({
        ...d,
        tasks: d.tasks
          .map((t) => {
            const u = byId.get(t.id);
            return u ? { ...t, column_id: u.column_id, position: u.position } : t;
          })
          .sort((a, b) => a.position - b.position),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(boardId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

// ── Task CRUD ────────────────────────────────────────────────────────
export function useCreateTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      columnId: string;
      title: string;
      assignee_id?: string | null;
    }) => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("column_id", vars.columnId);
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          board_id: boardId,
          column_id: vars.columnId,
          title: vars.title,
          assignee_id: vars.assignee_id ?? auth.user?.id ?? null,
          created_by: auth.user?.id ?? null,
          position: count ?? 0,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useUpdateTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { taskId: string; patch: Partial<Task> }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update(vars.patch)
        .eq("id", vars.taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

/** Cancel = move to the cancelled column + record reason (Brief §5). */
export function useCancelTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { taskId: string; reason: string | null }) => {
      const supabase = createClient();
      const { data: cancelledCol, error: colErr } = await supabase
        .from("board_columns")
        .select("id")
        .eq("board_id", boardId)
        .eq("is_cancelled_column", true)
        .single();
      if (colErr) throw colErr;
      const { error } = await supabase
        .from("tasks")
        .update({ column_id: cancelledCol.id, cancel_reason: vars.reason })
        .eq("id", vars.taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useArchiveTask(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

// ── Column CRUD (custom columns; canonical guarded in UI) ────────────
export function useCreateColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; color: string; position: number }) => {
      const supabase = createClient();
      const { error } = await supabase.from("board_columns").insert({
        board_id: boardId,
        name: vars.name,
        color: vars.color,
        position: vars.position,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useUpdateColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { columnId: string; patch: Partial<BoardColumn> }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("board_columns")
        .update(vars.patch)
        .eq("id", vars.columnId);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: boardKey(boardId) });
      const prev = qc.getQueryData<BoardData>(boardKey(boardId));
      patchBoard(qc, boardId, (d) => ({
        ...d,
        columns: d.columns.map((c) =>
          c.id === vars.columnId ? { ...c, ...vars.patch } : c,
        ),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(boardId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useReorderColumns(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: { id: string; position: number }[]) => {
      const supabase = createClient();
      // Sequential updates keep RLS simple; column counts are tiny.
      for (const c of ordered) {
        const { error } = await supabase
          .from("board_columns")
          .update({ position: c.position })
          .eq("id", c.id);
        if (error) throw error;
      }
    },
    onMutate: async (ordered) => {
      await qc.cancelQueries({ queryKey: boardKey(boardId) });
      const prev = qc.getQueryData<BoardData>(boardKey(boardId));
      const posById = new Map(ordered.map((c) => [c.id, c.position]));
      patchBoard(qc, boardId, (d) => ({
        ...d,
        columns: [...d.columns]
          .map((c) => ({ ...c, position: posById.get(c.id) ?? c.position }))
          .sort((a, b) => a.position - b.position),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey(boardId), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

export function useDeleteColumn(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (columnId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("board_columns").delete().eq("id", columnId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey(boardId) }),
  });
}

// ── Comments (the Remarks thread) ────────────────────────────────────
export type CommentWithAuthor = TaskComment & { author: AssigneeLite | null };

export function useComments(taskId: string | null) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["comments", taskId],
    queryFn: async (): Promise<CommentWithAuthor[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, author:profiles!task_comments_author_id_fkey(id, full_name, email, avatar_url)")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentWithAuthor[];
    },
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        author_id: auth.user!.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
  });
}
