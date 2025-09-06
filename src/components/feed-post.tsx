
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Timestamp, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

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
    };
    likes: string[];
    createdAt: Timestamp;
    currentUserId: string | null;
    onCommentClick: () => void;
}

export default function FeedPost({ id, mediaUrl, mediaType, title, description, user, likes, currentUserId, onCommentClick }: FeedPostProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const { toast } = useToast();

    const [isLiked, setIsLiked] = useState(currentUserId ? likes.includes(currentUserId) : false);
    const [likeCount, setLikeCount] = useState(likes.length);

    useEffect(() => {
      setIsLiked(currentUserId ? likes.includes(currentUserId) : false);
      setLikeCount(likes.length);
    }, [likes, currentUserId]);


    const togglePlay = () => {
        if (mediaType !== 'video' || !videoRef.current) return;
        
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
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

    useEffect(() => {
        const videoElement = videoRef.current;
        if (mediaType !== 'video' || !videoElement) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoElement.play().catch(() => setIsPlaying(false));
                    setIsPlaying(true);
                } else {
                    videoElement.pause();
                    setIsPlaying(false);
                }
            },
            { threshold: 0.5 }
        );

        observer.observe(videoElement);

        return () => {
            if (videoElement) {
                observer.unobserve(videoElement);
            }
        };
    }, [mediaType]);

    return (
        <div className="relative h-full w-full max-w-md mx-auto rounded-lg overflow-hidden" onClick={togglePlay}>
            {mediaType === 'video' ? (
                <video
                    ref={videoRef}
                    src={mediaUrl}
                    loop
                    className="w-full h-full object-cover"
                    playsInline
                />
            ) : (
                <Image
                    src={mediaUrl}
                    alt={description || 'Post image'}
                    layout="fill"
                    objectFit="cover"
                />
            )}
            

            {mediaType === 'video' && !isPlaying && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                    <Play className="h-16 w-16 text-white/70" />
                </div>
            )}
           
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex items-end">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                             <Avatar className="h-10 w-10 border-2 border-white">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-white">{user.name}</p>
                        </div>
                        <h3 className="text-white font-bold text-lg mt-2">{title}</h3>
                        <p className="text-white mt-1 text-sm">{description}</p>
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
    );
}
