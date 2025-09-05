
"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email: string;
}

interface Story {
    id: string;
    mediaUrl: string;
    mediaType: 'image';
    createdAt: any;
}

interface StoryViewerProps {
    stories: Story[];
    user: Partial<ChatUser>;
    onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export function StoryViewer({ stories, user, onClose }: StoryViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (stories.length === 0) {
            onClose();
            return;
        }

        const progressInterval = setInterval(() => {
            setProgress(prev => prev + (100 / (STORY_DURATION / 100)));
        }, 100);

        const storyTimeout = setTimeout(() => {
            if (currentIndex < stories.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setProgress(0);
            } else {
                onClose();
            }
        }, STORY_DURATION);

        return () => {
            clearTimeout(storyTimeout);
            clearInterval(progressInterval);
        };
    }, [currentIndex, stories, onClose]);
    
    useEffect(() => {
        // Reset progress when story changes
        setProgress(0);
    }, [currentIndex]);
    
    if (stories.length === 0 || !user) return null;

    const currentStory = stories[currentIndex];

    const goToPrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const getRelativeTime = (timestamp: any) => {
        if (!timestamp || !timestamp.seconds) return '';
        const now = new Date();
        const storyDate = new Date(timestamp.seconds * 1000);
        const diffInSeconds = Math.floor((now.getTime() - storyDate.getTime()) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        return `${diffInHours}h ago`;
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
            <div className="relative w-full max-w-md h-[90vh] rounded-lg overflow-hidden bg-black" onClick={(e) => e.stopPropagation()}>
                
                <Image src={currentStory.mediaUrl} alt={`Story from ${user.name}`} layout="fill" objectFit="contain" className="z-0" />
                
                <div className="absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
                     <div className="flex items-center gap-x-1">
                        {stories.map((_, index) => (
                            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white transition-all duration-100 ease-linear" 
                                    style={{ width: `${index === currentIndex ? progress : (index < currentIndex ? 100 : 0)}%` }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback>{user.name?.charAt(0) || user.email?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-white font-semibold text-sm">{user.name || user.email}</span>
                         <span className="text-white/80 text-xs">
                            {getRelativeTime(currentStory.createdAt)}
                         </span>
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white rounded-full bg-black/50 p-1.5">
                    <X size={20} />
                </button>
                
                {currentIndex > 0 && (
                    <button onClick={goToPrevious} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 text-white bg-black/50 p-2 rounded-full">
                        <ChevronLeft size={24} />
                    </button>
                )}

                {currentIndex < stories.length - 1 && (
                    <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 text-white bg-black/50 p-2 rounded-full">
                        <ChevronRight size={24} />
                    </button>
                )}

            </div>
        </div>
    );
}

    