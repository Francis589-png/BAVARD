
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ArrowLeft, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, onSnapshot, queryEqual } from "firebase/firestore";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
}

export default function ExplorePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [discoverUsers, setDiscoverUsers] = useState<ChatUser[]>([]);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);

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
          
          // To use 'not-in' query, the array cannot be empty.
          if (idsToExclude.length === 0) { 
             idsToExclude.push("placeholder-for-query"); // Should not happen if user is logged in
          }

          const discoverQuery = query(usersRef, where("id", "not-in", idsToExclude));
          
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
          setDiscoverUsers(users);
          setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [user]);
  
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
        // The onSnapshot listener will automatically update the discoverUsers list
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
            <div className="flex items-center gap-2">
                <MessageCircle className="w-8 h-8 text-primary" />
                <h1 className="text-xl font-bold">Explore New Friends</h1>
            </div>
        </header>

        <main className="p-4 md:p-6">
            {discoverUsers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {discoverUsers.map((u) => (
                        <Card key={u.id}>
                            <CardContent className="flex flex-col items-center justify-center p-6">
                                <Avatar className="h-20 w-20 mb-4">
                                    <AvatarImage src={u.avatar} alt={u.name} />
                                    <AvatarFallback>{u.name?.charAt(0) || u.email?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold text-lg text-center truncate w-full">{u.name}</h3>
                                <p className="text-muted-foreground text-sm text-center truncate w-full">{u.email}</p>

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
                    <h2 className="text-2xl font-semibold mt-4">All Caught Up!</h2>
                    <p className="text-muted-foreground mt-2">
                        There are no new users to discover right now.
                    </p>
                </div>
            )}
        </main>
    </div>
  );
}
