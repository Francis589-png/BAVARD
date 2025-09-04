
"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Progress } from "./ui/progress";

interface Story {
    id: string;
    mediaUrl: string;
    mediaType: 'image';
    createdAt: any;
    userName: string;
    userAvatar: string;
}

interface StoryViewerProps {
    stories: Story[];
    onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export function StoryViewer({ stories, onClose }: StoryViewerProps) {
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
    
    if (stories.length === 0) return null;

    const currentStory = stories[currentIndex];

    const goToPrevious = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setProgress(0);
        }
    };

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentIndex < stories.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    };


    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
            <div className="relative w-full max-w-md h-[90vh] rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                <Image src={currentStory.mediaUrl} alt={`Story from ${currentStory.userName}`} layout="fill" objectFit="cover" className="z-0" />
                
                <div className="absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
                     <div className="flex items-center gap-x-2">
                        {stories.map((_, index) => (
                            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full">
                                <div 
                                    className="h-full bg-white rounded-full" 
                                    style={{ width: `${index === currentIndex ? progress : (index < currentIndex ? 100 : 0)}%` }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={currentStory.userAvatar} />
                            <AvatarFallback>{currentStory.userName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-white font-semibold text-sm">{currentStory.userName}</span>
                         <span className="text-white/80 text-xs">
                             {new Date(currentStory.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </span>
                    </div>
                </div>

                <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white rounded-full bg-black/50 p-1">
                    <X size={24} />
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

