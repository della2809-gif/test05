"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/types/chat";

interface ConversationItemProps {
  conversation: Conversation;
}

export function ConversationItem({ conversation }: ConversationItemProps) {
  const pathname = usePathname();
  const isActive = pathname === `/chat/${conversation.id}`;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        "hover:bg-accent",
        isActive && "bg-accent font-medium"
      )}
    >
      <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="truncate">{conversation.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(conversation.updated_at)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={(e) => {
          e.preventDefault();
          // TODO: delete conversation
        }}
        aria-label="삭제"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </Link>
  );
}
