
"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ArrowLeft, MessageCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, query, where, getDocs, doc, writeBatch, serverTimestamp, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export default function ExplorePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [allDiscoverUsers, setAllDiscoverUsers] = useState<ChatUser[]>([]);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();
  const { toast } = useToast();

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
    if (user) {
      const usersRef = collection(db, "users");
      const contactsRef = collection(db, "users", user.uid, "contacts");
      
      const unsubscribe = onSnapshot(contactsRef, async (contactsSnapshot) => {
          const myContactIds = contactsSnapshot.docs.map(doc => doc.id);
          const idsToExclude = [user.uid, ...myContactIds];
          
          if (idsToExclude.length === 0) { 
             idsToExclude.push("placeholder-for-query");
          }

          const discoverQuery = query(usersRef, where("id", "not-in", idsToExclude));
          
          try {
            const usersSnapshot = await getDocs(discoverQuery);
            const users: ChatUser[] = [];
            usersSnapshot.forEach((doc) => {
                const data = doc.data();
                users.push({
                    id: data.id,
                    name: data.name,
                    avatar: data.avatar,
                    email: data.email
                });
            });
            setAllDiscoverUsers(users);
          } catch (error) {
            console.error("Error fetching discover users:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not load users to discover." });
          } finally {
            setLoading(false);
          }
      });

      return () => unsubscribe();
    }
  }, [user, toast]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) {
        return allDiscoverUsers;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return allDiscoverUsers.filter(u => 
        u.name?.toLowerCase().includes(lowercasedQuery) || 
        u.email?.toLowerCase().includes(lowercasedQuery)
    );
  }, [allDiscoverUsers, searchQuery]);
  
  const handleAddContact = async (contact: ChatUser) => {
      if (!user) return;
      setAddingContactId(contact.id);

      const contactDocRef = doc(db, "users", user.uid, "contacts", contact.id);
      
      const batch = writeBatch(db);
      batch.set(contactDocRef, { addedAt: serverTimestamp() });
      
      const currentUserContactDocRef = doc(db, "users", contact.id, "contacts", user.uid);
      batch.set(currentUserContactDocRef, { addedAt: serverTimestamp() });

      try {
        await batch.commit();
        toast({ title: "Contact Added", description: `You and ${contact.name} are now contacts.` });
        // The onSnapshot listener will automatically update the allDiscoverUsers list
      } catch (error) {
        console.error("Add contact error", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to add contact." });
      } finally {
        setAddingContactId(null);
      }
  };


  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
            <Link href="/chat" passHref>
                <Button variant="outline" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </Link>
            <div className="flex items-center gap-2 flex-1">
                <MessageCircle className="w-8 h-8 text-primary hidden sm:flex" />
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                        placeholder="Search creators by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-muted pl-10 w-full"
                    />
                </div>
            </div>
        </header>

        <main className="p-4 md:p-6">
            {filteredUsers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredUsers.map((u) => (
                        <Card key={u.id}>
                            <CardContent className="flex flex-col items-center justify-center p-6">
                                <Avatar className="h-20 w-20 mb-4">
                                    <AvatarImage src={u.avatar} alt={u.name} />
                                    <AvatarFallback>{u.name?.charAt(0) || u.email?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold text-lg text-center truncate w-full">{u.name || u.email}</h3>
                                {u.name && <p className="text-muted-foreground text-sm text-center truncate w-full">{u.email}</p>}

                                <Button 
                                    className="mt-4 w-full"
                                    onClick={() => handleAddContact(u)}
                                    disabled={addingContactId === u.id}
                                >
                                    {addingContactId === u.id ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <UserPlus className="mr-2 h-4 w-4" />
                                    )}
                                    Add Contact
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg mt-8">
                    <h2 className="text-2xl font-semibold mt-4">
                        {searchQuery ? "No Creators Found" : "All Caught Up!"}
                    </h2>
                    <p className="text-muted-foreground mt-2">
                         {searchQuery
                           ? "Try a different search term to find new creators."
                           : "There are no new users to discover right now."}
                    </p>
                </div>
            )}
        </main>
    </div>
  );
}
