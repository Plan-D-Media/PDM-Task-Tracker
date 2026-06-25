import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BoardView } from "@/components/board/board-view";

/**
 * A single tracker. The board is fetched server-side through RLS — if the
 * user can't read it (or it's archived), `data` is null and we 404. The
 * live Kanban/Table then re-reads via the browser client, also RLS-scoped.
 */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  await requireProfile();

  const supabase = await createClient();
  const { data: board } = await supabase
    .from("boards")
    .select("id, name")
    .eq("id", boardId)
    .is("archived_at", null)
    .single();

  if (!board) notFound();

  return <BoardView boardId={board.id} initialName={board.name} />;
}
