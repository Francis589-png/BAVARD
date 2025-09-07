
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Timestamp, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Play, Pause, FastForward, Rewind, Volume2, VolumeX, MoreVertical, Trash2, Flag } from "lucide-react";
import { Button } from "./ui/button";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "./ui/badge";
import { VerifiedBadge } from "./verified-badge";

export interface FeedPostProps {
    id: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    title: string;
    description: string;
    user: {
        id: string;
        name: string;
        avatar: string;
        isVerified?: boolean;
    };
    likes: string[];
    createdAt: Timestamp;
    categories?: string[];
    currentUserId: string | null;
    onCommentClick: () => void;
    onDelete: (postId: string) => void;
    onCategoryClick?: (category: string) => void;
}

export default function FeedPost({ id, mediaUrl, mediaType, title, description, user, likes, currentUserId, onCommentClick, onDelete, categories, onCategoryClick }: FeedPostProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const { toast } = useToast();

    const [isLiked, setIsLiked] = useState(currentUserId ? likes.includes(currentUserId) : false);
    const [likeCount, setLikeCount] = useState(likes.length);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

    const isMyPost = currentUserId === user.id;

    useEffect(() => {
      setIsLiked(currentUserId ? likes.includes(currentUserId) : false);
      setLikeCount(likes.length);
    }, [likes, currentUserId]);


    const togglePlay = () => {
        if (mediaType !== 'video' || !videoRef.current) return;
        
        if (videoRef.current.paused) {
            videoRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                setIsPlaying(false);
            });
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };
    
    const handleRewind = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.currentTime -= 10;
        }
    };

    const handleForward = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.currentTime += 10;
        }
    };
    
    const handleToggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    };

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUserId) {
            toast({ title: "Please log in", description: "You need to be logged in to like a post." });
            return;
        }

        const postRef = doc(db, "posts", id);
        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(currentUserId)
                });
                setLikeCount(prev => prev - 1);
                setIsLiked(false);
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(currentUserId)
                });
                setLikeCount(prev => prev + 1);
                setIsLiked(true);
            }
        } catch (error) {
            console.error("Error updating like:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not update like. Please try again." });
        }
    };
    
    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation();
        const postUrl = `${window.location.origin}/post/${id}`;
        navigator.clipboard.writeText(postUrl);
        toast({ title: "Link Copied!", description: "A link to this post has been copied to your clipboard." });
    };

    const confirmDeletePost = async () => {
        try {
            await deleteDoc(doc(db, "posts", id));
            toast({ title: "Post Deleted", description: "Your post has been successfully removed." });
            onDelete(id);
        } catch (error) {
            console.error("Error deleting post:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete post." });
        } finally {
            setIsDeleteAlertOpen(false);
        }
    };

     const handleReportPost = async () => {
        if (!currentUserId) {
            toast({ title: "Please log in", description: "You must be logged in to report a post." });
            return;
        }
        try {
            const reportsCollection = collection(db, 'reports');
            await addDoc(reportsCollection, {
                postId: id,
                reportedBy: currentUserId,
                createdAt: serverTimestamp(),
                reason: "Inappropriate Content", // Placeholder reason
            });
            toast({ title: "Post Reported", description: "Thank you for your feedback. An admin will review this post." });
        } catch (error) {
            console.error("Error reporting post:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not report post. Please try again." });
        }
    };

    useEffect(() => {
        const videoElement = videoRef.current;
        if (mediaType !== 'video' || !videoElement) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoElement.play().then(() => {
                        setIsPlaying(true);
                    }).catch(() => {
                        setIsPlaying(false);
                    });
                } else {
                    videoElement.pause();
                    setIsPlaying(false);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(videoElement);

        const handleVideoPause = () => setIsPlaying(false);
        const handleVideoPlay = () => setIsPlaying(true);

        videoElement.addEventListener('pause', handleVideoPause);
        videoElement.addEventListener('play', handleVideoPlay);

        return () => {
            if (videoElement) {
                observer.unobserve(videoElement);
                videoElement.removeEventListener('pause', handleVideoPause);
                videoElement.removeEventListener('play', handleVideoPlay);
            }
        };
    }, [mediaType]);


    return (
        <>
        <div className="relative h-full w-full max-w-md mx-auto rounded-lg overflow-hidden" onClick={togglePlay}>
            {mediaType === 'video' ? (
                <video
                    ref={videoRef}
                    src={mediaUrl}
                    loop
                    className="w-full h-full object-cover"
                    playsInline
                    muted // Start muted for autoplay
                />
            ) : (
                <Image
                    src={mediaUrl}
                    alt={description || 'Post image'}
                    layout="fill"
                    objectFit="cover"
                />
            )}
            
            <div className="absolute top-4 right-4 z-10 flex gap-2">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={handleToggleMute}>
                   {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                   <span className="sr-only">Toggle sound</span>
                </Button>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={e => e.stopPropagation()}>
                            <MoreVertical className="w-6 h-6" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onClick={e => e.stopPropagation()}>
                        {isMyPost ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => setIsDeleteAlertOpen(true)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Post
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem className="text-destructive" onClick={handleReportPost}>
                                <Flag className="mr-2 h-4 w-4" />
                                Report Post
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>

            {mediaType === 'video' && !isPlaying && (
                 <div className="absolute inset-0 flex items-center justify-center gap-8 bg-black/30 pointer-events-none">
                    <Button variant="ghost" size="icon" className="text-white/70 h-16 w-16 pointer-events-auto" onClick={handleRewind}><Rewind className="h-10 w-10" /></Button>
                    <Play className="h-16 w-16 text-white/70" />
                    <Button variant="ghost" size="icon" className="text-white/70 h-16 w-16 pointer-events-auto" onClick={handleForward}><FastForward className="h-10 w-10" /></Button>
                </div>
            )}
           
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-end">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                             <Link href={`/profile/${user.id}`} className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Avatar className="h-10 w-10 border-2 border-white">
                                    <AvatarImage src={user.avatar} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                    {user.name}
                                    {user.isVerified && <VerifiedBadge />}
                                </div>
                            </Link>
                        </div>
                        <h3 className="text-white font-bold text-lg mt-2">{title}</h3>
                        <p className="text-white mt-1 text-sm">{description}</p>
                        {categories && categories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2" onClick={e => e.stopPropagation()}>
                                {categories.map((category, index) => (
                                    <Badge 
                                        key={index}
                                        variant="secondary" 
                                        className="backdrop-blur-sm bg-black/20 text-white border-white/20 cursor-pointer hover:bg-white/30"
                                        onClick={() => onCategoryClick?.(category)}
                                    >
                                        {category}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-center gap-2 text-white">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full flex flex-col h-auto p-2" onClick={handleLike}>
                            <Heart className={`w-7 h-7 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                            <span className="text-xs font-bold">{likeCount}</span>
                        </Button>
                         <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full flex flex-col h-auto p-2" onClick={(e) => { e.stopPropagation(); onCommentClick(); }}>
                            <MessageCircle className="w-7 h-7" />
                            <span className="text-xs font-bold">...</span>
                        </Button>
                         <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={handleShare}>
                            <Share2 className="w-7 h-7" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your post from the feed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeletePost} className="bg-destructive hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
