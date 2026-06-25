"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCreateColumn } from "@/lib/queries/board-data";

const SWATCHES = [
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#64748b",
];

/** Adds a custom status column. `nextPosition` is appended after the last. */
export function AddColumnDialog({
  boardId,
  nextPosition,
}: {
  boardId: string;
  nextPosition: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const createColumn = useCreateColumn(boardId);

  function submit() {
    const n = name.trim();
    if (!n) return;
    createColumn.mutate(
      { name: n, color, position: nextPosition },
      {
        onSuccess: () => {
          setName("");
          setColor(SWATCHES[0]);
          setOpen(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex h-9 w-72 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)] transition-colors hover:border-[var(--ring)] hover:text-[var(--foreground)]">
          <Plus className="size-4" /> Add column
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New column</DialogTitle>
          <DialogDescription>
            A custom status lane for this board.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="col-name">Name</Label>
          <Input
            id="col-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. In Review"
          />
        </div>
        <div className="space-y-2">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  "size-6 rounded-full ring-offset-2 ring-offset-[var(--card)] transition",
                  color === c && "ring-2 ring-[var(--ring)]",
                )}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || createColumn.isPending}>
            Add column
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
