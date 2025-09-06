
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Timestamp } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";

export interface FeedPostProps {
    id: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    description: string;
    user: {
        name: string;
        avatar: string;
    };
    createdAt: Timestamp;
}

export default function FeedPost({ mediaUrl, mediaType, description, user }: FeedPostProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

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

    useEffect(() => {
        const videoElement = videoRef.current;
        if (mediaType !== 'video' || !videoElement) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoElement.play().catch(() => {
                        setIsPlaying(false);
                    });
                    setIsPlaying(true);
                } else {
                    videoElement.pause();
                    setIsPlaying(false);
                }
            },
            {
                threshold: 0.5,
            }
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
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <p className="font-bold text-white">{user.name}</p>
                        </div>
                        <p className="text-white mt-2 text-sm">{description}</p>
                    </div>
                    <div className="flex flex-col items-center gap-4 text-white">
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                            <Heart className="w-7 h-7" />
                        </Button>
                         <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                            <MessageCircle className="w-7 h-7" />
                        </Button>
                         <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                            <Share2 className="w-7 h-7" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
