
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, getDocs, where } from "firebase/firestore";
import { Loader2, Send } from "lucide-react";
import type { User } from "firebase/auth";
import { formatDistanceToNow } from 'date-fns';

interface Comment {
    id: string;
    userId: string;
    text: string;
    createdAt: Timestamp;
    user: {
        name: string;
        avatar: string;
    };
}

interface Post {
    id: string;
    user: {
        name: string;
        avatar: string;
    }
}

interface CommentSheetProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    post: Post | null;
    currentUser: User | null;
}

export function CommentSheet({ isOpen, onOpenChange, post, currentUser }: CommentSheetProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    useEffect(() => {
        if (!post?.id || !isOpen) {
            setComments([]);
            return;
        }

        setIsLoading(true);
        const commentsQuery = query(collection(db, "posts", post.id, "comments"), orderBy("createdAt", "asc"));
        
        const unsubscribe = onSnapshot(commentsQuery, async (snapshot) => {
            const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Omit<Comment, 'user'>[])
            
            const userIds = Array.from(new Set(commentsData.map(c => c.userId)));
            const usersData: Record<string, {name: string, avatar: string}> = {};

            if (userIds.length > 0) {
                const usersRef = collection(db, 'users');
                const usersQuery = query(usersRef, where('__name__', 'in', userIds));
                const usersSnapshot = await getDocs(usersQuery);
                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    usersData[doc.id] = { name: data.name, avatar: data.avatar };
                });
            }

            const fetchedComments = commentsData.map(comment => {
                const author = usersData[comment.userId] || { name: 'Unknown User', avatar: '' };
                return { ...comment, user: author };
            });

            setComments(fetchedComments);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [post, isOpen]);

    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!post || !currentUser || newComment.trim() === "") return;

        setIsPosting(true);
        try {
            const commentsCollection = collection(db, "posts", post.id, "comments");
            await addDoc(commentsCollection, {
                userId: currentUser.uid,
                text: newComment,
                createdAt: serverTimestamp()
            });
            setNewComment("");
        } catch (error) {
            console.error("Error posting comment:", error);
        } finally {
            setIsPosting(false);
        }
    };
    
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[80vh] flex flex-col">
                <SheetHeader className="text-center">
                    <SheetTitle>Comments</SheetTitle>
                     <SheetDescription>
                        {post?.user?.name}'s post
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                         <div className="flex justify-center items-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center text-muted-foreground pt-10">
                            <p>No comments yet.</p>
                            <p>Be the first to comment!</p>
                        </div>
                    ) : (
                        comments.map(comment => (
                             <div key={comment.id} className="flex items-start gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={comment.user.avatar} />
                                    <AvatarFallback>{comment.user.name?.charAt(0) || '?'}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm">{comment.user.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                           {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : ''}
                                        </p>
                                    </div>
                                    <p className="text-sm">{comment.text}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t">
                    <form onSubmit={handlePostComment} className="flex items-center gap-2">
                         <Textarea 
                            placeholder="Add a comment..." 
                            className="flex-1 resize-none"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            rows={1}
                        />
                        <Button type="submit" size="icon" disabled={isPosting}>
                             {isPosting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </Button>
                    </form>
                </div>
            </SheetContent>
        </Sheet>
    );
}
