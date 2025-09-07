
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface BavardMessageDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSendMessage: (message: string) => Promise<void>;
  userName: string | null;
}

export function BavardMessageDialog({ isOpen, onOpenChange, onSendMessage, userName }: BavardMessageDialogProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() === "") return;
    
    setIsSending(true);
    await onSendMessage(message);
    setIsSending(false);
    setMessage("");
    onOpenChange(false); // Close dialog on success
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Message from BAVARD</DialogTitle>
            <DialogDescription>
              Send an official message to {userName || "this user"}. This will appear as a system message and they cannot reply.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Type your official message here... (e.g., a warning about community guidelines)."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSending}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send Message"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
