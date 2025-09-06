
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { collection, query, orderBy, onSnapshot, getDocs, where, Timestamp } from "firebase/firestore";
import VideoPost, { VideoPostProps } from "./video-post";
import Link from "next/link";
import { Card } from "./ui/card";

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export default function ForYouPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<VideoPostProps[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const videosQuery = query(collection(db, "videos"), orderBy("createdAt", "desc"));

    const unsubscribeVideos = onSnapshot(videosQuery, async (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const authorIds = Array.from(new Set(videosData.map(v => v.userId)));
      const usersData: Record<string, Partial<ChatUser>> = {};

      if (authorIds.length > 0) {
        const usersRef = collection(db, 'users');
        // Firestore 'in' query has a limit of 10 items.
        // For a real app, you would need to batch these requests.
        const usersQuery = query(usersRef, where('__name__', 'in', authorIds.slice(0, 10)));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            usersData[doc.id] = { name: userData.name, avatar: userData.avatar };
        });
      }
      
      const fetchedVideos: VideoPostProps[] = videosData.map(video => {
        const author = usersData[video.userId] || { name: 'Unknown', avatar: '' };
        return {
          id: video.id,
          videoUrl: video.videoUrl,
          description: video.description,
          user: {
            name: author.name || 'Unknown User',
            avatar: author.avatar || ''
          },
          createdAt: video.createdAt,
        };
      });

      setVideos(fetchedVideos);
      setLoading(false);
    });

    return () => unsubscribeVideos();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="bg-black text-white h-screen overflow-y-scroll snap-y snap-mandatory">
      <header className="fixed top-0 left-0 z-10 p-4">
        <Link href="/chat" passHref>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
            <ArrowLeft />
          </Button>
        </Link>
      </header>

      <div className="relative h-full w-full">
        {videos.length > 0 ? (
           videos.map(video => (
            <div key={video.id} className="h-screen w-full flex items-center justify-center snap-start">
               <VideoPost {...video} />
            </div>
          ))
        ) : (
          <div className="h-screen w-full flex items-center justify-center snap-start">
            <div className="text-center">
              <h2 className="text-2xl font-bold">No Videos Yet</h2>
              <p className="text-muted-foreground">Be the first to post a video!</p>
              <Button onClick={() => router.push('/create-post')} className="mt-4">
                  Upload Video
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
