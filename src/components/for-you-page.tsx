
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { collection, query, orderBy, onSnapshot, getDocs, where, Timestamp, getDocsFromCache, collectionGroup } from "firebase/firestore";
import FeedPost, { FeedPostProps } from "./feed-post";
import Link from "next/link";
import { CommentSheet } from "./comment-sheet";
import { Input } from "./ui/input";


interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

interface Post extends Omit<FeedPostProps, 'currentUserId' | 'onCommentClick' | 'user' | 'likes'> {
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
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

    const fetchPosts = async () => {
        setLoading(true);

        const contactsRef = collection(db, "users", user.uid, "contacts");
        const contactsSnapshot = await getDocs(contactsRef);
        const contactIds = contactsSnapshot.docs.map(doc => doc.id);

        const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const postsSnapshot = await getDocs(postsQuery);
        
        const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Omit<Post, 'user'> & {userId: string})[];
        
        const authorIds = Array.from(new Set(postsData.map(p => p.userId)));
        const usersData: Record<string, ChatUser> = {};

        if (authorIds.length > 0) {
            const usersRef = collection(db, 'users');
            const usersQuery = query(usersRef, where('__name__', 'in', authorIds.slice(0, 10)));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(doc => {
                const data = doc.data();
                usersData[doc.id] = { id: doc.id, name: data.name, avatar: data.avatar, email: data.email };
            });
        }
      
        const fetchedPosts: Post[] = postsData.map(post => {
            const author = usersData[post.userId] || { id: post.userId, name: 'Unknown', avatar: '', email: '' };
            return {
                ...post,
                user: { id: author.id, name: author.name || 'Unknown User', avatar: author.avatar || '' },
            };
        }).filter(p => p.user.name !== 'Unknown');

        // Algorithm:
        // 1. Separate posts from contacts and others
        const contactPosts = fetchedPosts.filter(p => contactIds.includes(p.userId));
        const otherPosts = fetchedPosts.filter(p => !contactIds.includes(p.userId));

        // 2. Sort other posts by like count (virality)
        otherPosts.sort((a, b) => b.likes.length - a.likes.length);

        // 3. Combine them: contact posts first, then popular posts
        const sortedPosts = [...contactPosts, ...otherPosts];

        setPosts(sortedPosts);
        setLoading(false);
    };

    fetchPosts();

  }, [user]);

  useEffect(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = posts.filter(post => 
      post.title?.toLowerCase().includes(lowercasedQuery) ||
      post.description?.toLowerCase().includes(lowercasedQuery)
    );
    setFilteredPosts(filtered);
  }, [searchQuery, posts]);

  const handleCommentClick = (post: Post) => {
    setSelectedPostForComments(post);
    setIsCommentSheetOpen(true);
  };

  if (loading || !user) {
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
          {filteredPosts.length > 0 ? (
            filteredPosts.map(post => (
              <div key={post.id} className="h-screen w-full flex items-center justify-center snap-start">
                <FeedPost 
                  {...post} 
                  currentUserId={user.uid}
                  onCommentClick={() => handleCommentClick(post)}
                />
              </div>
            ))
          ) : (
            <div className="h-screen w-full flex items-center justify-center snap-start">
              <div className="text-center">
                <h2 className="text-2xl font-bold">{searchQuery ? "No Results Found" : "No Posts Yet"}</h2>
                <p className="text-muted-foreground">
                  {searchQuery ? "Try a different search term." : "Be the first to post something!"}
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
