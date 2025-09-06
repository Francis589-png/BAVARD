
"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Timestamp } from "firebase/firestore";
import { Heart, MessageCircle, Share2, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";

export interface VideoPostProps {
    id: string;
    videoUrl: string;
    description: string;
    user: {
        name: string;
        avatar: string;
    };
    createdAt: Timestamp;
}

export default function VideoPost({ videoUrl, description, user, createdAt }: VideoPostProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const togglePlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    useEffect(() => {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    videoElement.play().catch(() => {
                        // Autoplay was prevented.
                        setIsPlaying(false);
                    });
                    setIsPlaying(true);
                } else {
                    videoElement.pause();
                    setIsPlaying(false);
                }
            },
            {
                threshold: 0.5, // Play when at least 50% of the video is visible
            }
        );

        observer.observe(videoElement);

        return () => {
            if (videoElement) {
                observer.unobserve(videoElement);
            }
        };
    }, []);

    return (
        <div className="relative h-full w-full max-w-md mx-auto rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                src={videoUrl}
                loop
                className="w-full h-full object-cover"
                onClick={togglePlay}
                playsInline // Important for iOS
            />

            {!isPlaying && (
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
