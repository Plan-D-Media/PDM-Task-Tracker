"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBoard } from "@/lib/actions/boards";

export function CreateBoardDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "department">("private");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setPending(true);
    const res = await createBoard({
      name: name.trim(),
      visibility,
      description: description.trim() || undefined,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Tracker created");
    setOpen(false);
    setName("");
    setDescription("");
    setVisibility("private");
    router.push(`/board/${res.boardId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full justify-start">
          <Plus /> New tracker
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New tracker</DialogTitle>
          <DialogDescription>
            A board for a project, client, or workstream.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="b-name">Name</Label>
          <Input
            id="b-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Q3 Campaign — Acme"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as "private" | "department")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private — only people I add</SelectItem>
              <SelectItem value="department">Department — my whole team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b-desc">Description (optional)</Label>
          <Textarea
            id="b-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this tracker for?"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || pending}>
            {pending && <Loader2 className="animate-spin" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
