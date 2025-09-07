
"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "./ui/dialog";
import { Eye, Lock } from "lucide-react";
import Image from "next/image";
import type { User } from "firebase/auth";

interface Message {
    id: string;
    senderId: string;
    type: 'text' | 'image' | 'audio' | 'file';
    text?: string;
    url?: string;
    fileName?: string;
    isViewOnce?: boolean;
    viewedBy?: string[];
}

interface ViewOnceMessageProps {
    message: Message;
    currentUser: User | null;
    onOpen: (messageId: string) => void;
}

export default function ViewOnceMessage({ message, currentUser, onOpen }: ViewOnceMessageProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    if (!currentUser) return null;

    const isMyMessage = message.senderId === currentUser.uid;
    const hasViewed = message.viewedBy?.includes(currentUser.uid) ?? false;

    const handleOpen = () => {
        if (!isMyMessage && !hasViewed) {
            setIsDialogOpen(true);
            onOpen(message.id);
        }
    };
    
    if (isMyMessage) {
        return (
            <div className="flex items-center gap-2 text-primary-foreground/80">
                <Eye className="w-4 h-4" />
                <span>View-once message sent</span>
            </div>
        );
    }
    
    if (hasViewed) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span>Message viewed</span>
            </div>
        );
    }


    return (
        <>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>View Once Message</DialogTitle>
                    </DialogHeader>
                    <div className="my-4">
                       {message.type === 'text' && <p className="text-lg">{message.text}</p>}
                       {message.type === 'image' && message.url && (
                           <Image src={message.url} alt="View once image" width={500} height={500} className="rounded-md object-contain"/>
                       )}
                        {message.type === 'audio' && message.url && (
                            <audio controls autoPlay src={message.url} className="w-full">
                                Your browser does not support the audio element.
                            </audio>
                        )}
                        {message.type === 'file' && message.url && (
                            <p className="text-center text-muted-foreground">This file cannot be previewed. It will open in a new tab.</p>
                        )}
                    </div>
                    <DialogFooter>
                        {message.type === 'file' && message.url ? (
                             <a href={message.url} target="_blank" rel="noopener noreferrer" onClick={() => setIsDialogOpen(false)}>
                                <Button>Open File</Button>
                            </a>
                        ) : (
                            <DialogClose asChild>
                                <Button>Close</Button>
                            </DialogClose>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

             <Button variant="outline" onClick={handleOpen} className="bg-muted/20 hover:bg-muted/40 text-current">
                <Eye className="mr-2 h-4 w-4" />
                Tap to view
            </Button>
        </>
    );
}
