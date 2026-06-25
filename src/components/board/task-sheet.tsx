"use client";

import { useState } from "react";
import { Archive, Ban, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, SheetContent } from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback, AvatarImage, initials } from "@/components/ui/avatar";
import {
  PERIOD_LABEL,
  PRIORITY_META,
  TASK_TYPE_META,
  type TaskPeriod,
  type TaskPriority,
  type TaskType,
} from "@/lib/constants";
import { fmt, isoToLocalInput, localInputToIso } from "@/lib/dates";
import {
  useAddComment,
  useArchiveTask,
  useCancelTask,
  useComments,
  useProfiles,
  useUpdateTask,
  type TaskWithAssignee,
} from "@/lib/queries/board-data";

const UNASSIGNED = "__unassigned__";

export function TaskSheet({
  boardId,
  task,
  onOpenChange,
}: {
  boardId: string;
  task: TaskWithAssignee | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      {task && (
        <SheetContent className="gap-0">
          <TaskSheetBody
            key={task.id}
            boardId={boardId}
            task={task}
            onClose={() => onOpenChange(false)}
          />
        </SheetContent>
      )}
    </Dialog>
  );
}

function TaskSheetBody({
  boardId,
  task,
  onClose,
}: {
  boardId: string;
  task: TaskWithAssignee;
  onClose: () => void;
}) {
  const { data: profiles = [] } = useProfiles();
  const updateTask = useUpdateTask(boardId);
  const cancelTask = useCancelTask(boardId);
  const archiveTask = useArchiveTask(boardId);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [taskType, setTaskType] = useState<TaskType>(task.task_type);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [period, setPeriod] = useState<TaskPeriod>(task.period);
  const [assignee, setAssignee] = useState(task.assignee_id ?? UNASSIGNED);
  const [due, setDue] = useState(isoToLocalInput(task.due_date));
  // State is initialised from `task` and reset by the `key={task.id}` on this
  // component — so switching tasks remounts with fresh values, and an in-flight
  // edit is never clobbered by a background refetch of the same task.

  function save() {
    const patch = {
      title: title.trim() || task.title,
      description: description.trim() || null,
      task_type: taskType,
      priority,
      period,
      assignee_id: assignee === UNASSIGNED ? null : assignee,
      due_date: localInputToIso(due),
    };
    updateTask.mutate(
      { taskId: task.id, patch },
      {
        onSuccess: () => toast.success("Task saved"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function cancel() {
    const reason = window.prompt("Reason for cancelling this task?")?.trim();
    if (reason === undefined) return; // user dismissed
    cancelTask.mutate(
      { taskId: task.id, reason: reason || null },
      {
        onSuccess: () => {
          toast.success("Task cancelled");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function archive() {
    if (!window.confirm("Archive this task? It will be hidden from the board.")) return;
    archiveTask.mutate(task.id, {
      onSuccess: () => {
        toast.success("Task archived");
        onClose();
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4 pr-6">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_TYPE_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Period">
              <Select value={period} onValueChange={(v) => setPeriod(v as TaskPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assignee">
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Due date">
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>

          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add detail…"
              className="min-h-24"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={updateTask.isPending}>
              {updateTask.isPending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
            <Button variant="outline" onClick={cancel} disabled={cancelTask.isPending}>
              <Ban /> Cancel task
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={archive}
              title="Archive task"
              disabled={archiveTask.isPending}
            >
              <Archive />
            </Button>
          </div>
        </div>

        <Comments taskId={task.id} />
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Comments({ taskId }: { taskId: string }) {
  const { data: comments = [], isLoading } = useComments(taskId);
  const addComment = useAddComment(taskId);
  const [body, setBody] = useState("");

  function send() {
    const text = body.trim();
    if (!text) return;
    addComment.mutate(text, {
      onSuccess: () => setBody(""),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  return (
    <div className="mt-8 border-t border-border pt-5">
      <h3 className="mb-3 text-sm font-semibold">Remarks</h3>

      <div className="space-y-3">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Loading…</p>
        )}
        {!isLoading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No remarks yet. Start the thread below.
          </p>
        )}
        {comments.map((c) => {
          const name = c.author?.full_name || c.author?.email || "Someone";
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="size-6">
                {c.author?.avatar_url ? (
                  <AvatarImage src={c.author.avatar_url} alt={name} />
                ) : null}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {fmt(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap wrap-break-word text-sm">{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Write a remark… (⌘/Ctrl+Enter)"
          className="min-h-11"
        />
        <Button size="icon" onClick={send} disabled={addComment.isPending || !body.trim()}>
          <Send />
        </Button>
      </div>
    </div>
  );
}
