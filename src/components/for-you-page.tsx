
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { collection, query, onSnapshot, getDocs, where, Timestamp, DocumentData, deleteDoc, doc } from "firebase/firestore";
import FeedPost, { FeedPostProps } from "./feed-post";
import Link from "next/link";
import { CommentSheet } from "./comment-sheet";
import { Input } from "./ui/input";
import { getForYouFeed } from "@/ai/flows/foryou-flow";


interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

interface Post extends Omit<FeedPostProps, 'currentUserId' | 'onCommentClick' | 'user' | 'likes' | 'onDelete'> {
    userId: string;
    likes: string[];
    user: {
        id: string;
        name: string;
        avatar: string;
    }
}


export default function ForYouPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [rankedPostIds, setRankedPostIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  
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
    setLoading(true);

    const postsQuery = query(collection(db, "posts"));
    
    const unsubscribePosts = onSnapshot(postsQuery, async (postsSnapshot) => {
        const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Omit<Post, 'user'> & {userId: string})[];
      
        const authorIds = Array.from(new Set(postsData.map(p => p.userId)));
        const usersData: Record<string, ChatUser> = {};

        if (authorIds.length > 0) {
            const usersRef = collection(db, 'users');
            const authorChunks: string[][] = [];
            for (let i = 0; i < authorIds.length; i += 30) {
                authorChunks.push(authorIds.slice(i, i + 30));
            }
            
            await Promise.all(authorChunks.map(async chunk => {
                const usersQuery = query(usersRef, where('__name__', 'in', chunk));
                const usersSnapshot = await getDocs(usersQuery);
                usersSnapshot.forEach(doc => {
                    const data = doc.data();
                    usersData[doc.id] = { id: doc.id, name: data.name, avatar: data.avatar, email: data.email };
                });
            }));
        }
    
        const fetchedPosts: Post[] = postsData.map(post => {
            const author = usersData[post.userId] || { id: post.userId, name: 'Unknown', avatar: '', email: '' };
            return {
                ...post,
                user: { id: author.id, name: author.name || 'Unknown User', avatar: author.avatar || '' },
            };
        }).filter(p => p.user.name !== 'Unknown');
        
        setAllPosts(fetchedPosts);
        
        // Now get the ranking from the AI
        const contactsRef = collection(db, "users", user.uid, "contacts");
        const contactsSnapshot = await getDocs(contactsRef);
        const contactIds = contactsSnapshot.docs.map(doc => doc.id);

        try {
            const feedResponse = await getForYouFeed({
                userId: user.uid,
                posts: fetchedPosts.map(p => ({ id: p.id, title: p.title, description: p.description || '', userId: p.userId, likes: p.likes })),
                contactIds: contactIds,
            });

            setRankedPostIds(feedResponse.rankedPostIds);
        } catch (error) {
            console.error("Error getting For You feed:", error);
            // Fallback to a simple sort if AI fails
            const sortedPosts = fetchedPosts.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setRankedPostIds(sortedPosts.map(p => p.id));
        } finally {
            setLoading(false);
        }
    });

    return () => unsubscribePosts();
  }, [user]);

  const sortedAndFilteredPosts = useMemo(() => {
    const postsById = new Map(allPosts.map(p => [p.id, p]));
    
    // Start with the AI-ranked order
    let orderedPosts = rankedPostIds.map(id => postsById.get(id)).filter(Boolean) as Post[];

    // If search is active, filter the ranked posts
    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        orderedPosts = orderedPosts.filter(post => 
          post.title?.toLowerCase().includes(lowercasedQuery) ||
          post.description?.toLowerCase().includes(lowercasedQuery)
        );
    }
    
    return orderedPosts;
  }, [allPosts, rankedPostIds, searchQuery]);


  const handleCommentClick = (post: Post) => {
    setSelectedPostForComments(post);
    setIsCommentSheetOpen(true);
  };

  const handleDeletePost = (postId: string) => {
    setAllPosts(prev => prev.filter(p => p.id !== postId));
  };
  

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-black text-white h-screen overflow-y-scroll snap-y snap-mandatory">
        <header className="fixed top-0 left-0 z-10 p-4 flex items-center w-full gap-4">
          <Link href="/chat" passHref>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 flex-shrink-0">
              <ArrowLeft />
            </Button>
          </Link>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input 
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800/80 border-gray-700 text-white pl-10 w-full"
            />
          </div>
        </header>

        <div className="relative h-full w-full pt-16">
          {sortedAndFilteredPosts.length > 0 ? (
            <>
            {sortedAndFilteredPosts.map(post => (
              <div key={post.id} className="h-screen w-full flex items-center justify-center snap-start">
                <FeedPost 
                  {...post} 
                  currentUserId={user?.uid || null}
                  onCommentClick={() => handleCommentClick(post)}
                  onDelete={handleDeletePost}
                />
              </div>
            ))}
            </>
          ) : (
            <div className="h-screen w-full flex items-center justify-center snap-start">
              <div className="text-center">
                <h2 className="text-2xl font-bold">{searchQuery ? "No Results Found" : "No Posts Yet"}</h2>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try a different search term." : "Create the first post to see it here!"}
                </p>
                <Button onClick={() => router.push('/create-post')} className="mt-4">
                    Create Post
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {selectedPostForComments && user && (
          <CommentSheet 
              isOpen={isCommentSheetOpen}
              onOpenChange={setIsCommentSheetOpen}
              post={selectedPostForComments}
              currentUser={user}
          />
      )}
    </>
  );
}
