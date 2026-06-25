"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

const createBoardSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  visibility: z.enum(["private", "department"]),
  description: z.string().trim().max(500).optional(),
});

export type CreateBoardResult =
  | { ok: true; boardId: string }
  | { ok: false; message: string };

/**
 * Create a tracker. The owner is always the caller; the AFTER-INSERT
 * trigger seeds the 4 canonical columns. RLS also guards this insert.
 */
export async function createBoard(
  input: z.infer<typeof createBoardSchema>,
): Promise<CreateBoardResult> {
  const me = await requireProfile();
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({
      name: parsed.data.name,
      visibility: parsed.data.visibility,
      description: parsed.data.description ?? null,
      owner_id: me.id,
      created_by: me.id,
      department_id: me.department_id, // trigger also backfills if null
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Could not create board." };
  }
  revalidatePath("/");
  return { ok: true, boardId: data.id };
}

export async function archiveBoard(boardId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("boards")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", boardId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/");
  return { ok: true };
}
