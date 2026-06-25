"use client";

import { CheckSquare, Phone, Users } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  initials,
} from "@/components/ui/avatar";
import { PRIORITY_META, type TaskPriority, type TaskType } from "@/lib/constants";
import { dueLabel, isDueSoon, isOverdue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AssigneeLite } from "@/lib/queries/board-data";

const TYPE_ICON = { task: CheckSquare, meeting: Users, call: Phone } as const;

/** Small monochrome glyph distinguishing task / meeting / call (Brief §5). */
export function TypeIcon({
  type,
  className,
}: {
  type: TaskType;
  className?: string;
}) {
  const Icon = TYPE_ICON[type];
  return <Icon className={cn("size-3.5 text-[var(--muted-foreground)]", className)} />;
}

export function PriorityDot({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className="mt-1 inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: meta.color }}
      title={`${meta.label} priority`}
    />
  );
}

export function AssigneeAvatar({
  user,
  className,
}: {
  user: AssigneeLite | null;
  className?: string;
}) {
  if (!user) return null;
  const name = user.full_name || user.email;
  return (
    <Avatar className={cn("size-6", className)}>
      {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={name} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Due-date pill: red when overdue, amber when due soon (Brief §6 feel). */
export function DueBadge({
  due,
  done,
  className,
}: {
  due: string | null;
  done?: boolean;
  className?: string;
}) {
  if (!due) return null;
  const overdue = !done && isOverdue(due);
  const soon = !done && !overdue && isDueSoon(due);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        overdue
          ? "bg-[var(--overdue)]/10 text-[var(--overdue)]"
          : soon
            ? "bg-[var(--status-wip)]/10 text-[var(--status-wip)]"
            : "bg-[var(--muted)] text-[var(--muted-foreground)]",
        className,
      )}
    >
      {dueLabel(due)}
    </span>
  );
}
