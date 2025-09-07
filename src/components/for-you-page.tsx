
"use client";

import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { collection, query, orderBy, onSnapshot, getDocs, where, Timestamp, limit, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
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

const POSTS_PER_PAGE = 5;

export default function ForYouPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const router = useRouter();

  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<Post | null>(null);
  
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allPostsLoaded, setAllPostsLoaded] = useState(false);

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
  
  const fetchPosts = useCallback(async (initialLoad = false) => {
      if (!user || loadingMore || allPostsLoaded) return;

      if(initialLoad) setLoading(true);
      else setLoadingMore(true);

      const contactsRef = collection(db, "users", user.uid, "contacts");
      const contactsSnapshot = await getDocs(contactsRef);
      const contactIds = contactsSnapshot.docs.map(doc => doc.id);
      
      let postsQuery;
      if (initialLoad) {
          postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(POSTS_PER_PAGE));
      } else if(lastVisible) {
          postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(POSTS_PER_PAGE));
      } else {
          return; // Should not happen
      }

      const postsSnapshot = await getDocs(postsQuery);

      if (postsSnapshot.empty) {
          setAllPostsLoaded(true);
          if (initialLoad) setLoading(false);
          setLoadingMore(false);
          return;
      }
      
      setLastVisible(postsSnapshot.docs[postsSnapshot.docs.length - 1]);
      
      const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as (Omit<Post, 'user'> & {userId: string})[];
      
      const authorIds = Array.from(new Set(postsData.map(p => p.userId)));
      const usersData: Record<string, ChatUser> = {};

      if (authorIds.length > 0) {
          const usersRef = collection(db, 'users');
          // Firestore 'in' query supports up to 30 items. We fetch in chunks if needed.
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

      const sortedPosts = fetchedPosts.sort((a, b) => {
          const aIsContact = contactIds.includes(a.userId);
          const bIsContact = contactIds.includes(b.userId);
          if (aIsContact && !bIsContact) return -1;
          if (!aIsContact && bIsContact) return 1;
          return b.likes.length - a.likes.length;
      });

      setPosts(prevPosts => initialLoad ? sortedPosts : [...prevPosts, ...sortedPosts]);
      if(initialLoad) setLoading(false);
      setLoadingMore(false);

  }, [user, loadingMore, allPostsLoaded, lastVisible]);


  useEffect(() => {
    if (user) {
      fetchPosts(true);
    }
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
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 100 && !loadingMore && !allPostsLoaded) {
          fetchPosts();
      }
  };


  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-black text-white h-screen overflow-y-scroll snap-y snap-mandatory" onScroll={handleScroll}>
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
            <>
            {filteredPosts.map(post => (
              <div key={post.id} className="h-screen w-full flex items-center justify-center snap-start">
                <FeedPost 
                  {...post} 
                  currentUserId={user?.uid || null}
                  onCommentClick={() => handleCommentClick(post)}
                />
              </div>
            ))}
             {loadingMore && (
                <div className="h-24 flex items-center justify-center snap-start">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
            )}
            </>
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
