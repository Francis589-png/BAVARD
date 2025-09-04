
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ArrowLeft, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { collection, query, where, getDocs, doc, getDoc, writeBatch, serverTimestamp, onSnapshot } from "firebase/firestore";
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
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [myContactIds, setMyContactIds] = useState<string[]>([]);
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
      // Get all users
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, where("id", "!=", user.uid));
      const unsubscribeUsers = onSnapshot(q, (querySnapshot) => {
        const users: ChatUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: data.id,
            name: data.name,
            avatar: data.avatar,
            email: data.email
          });
        });
        setAllUsers(users);
        setLoading(false);
      });
      
      // Get my contacts
      const contactsCollection = collection(db, "users", user.uid, "contacts");
      const unsubscribeContacts = onSnapshot(contactsCollection, (snapshot) => {
          setMyContactIds(snapshot.docs.map(doc => doc.id));
      });

      return () => {
        unsubscribeUsers();
        unsubscribeContacts();
      };
    }
  }, [user]);
  
  const handleAddContact = async (contact: ChatUser) => {
      if (!user) return;
      setAddingContactId(contact.id);

      const contactDocRef = doc(db, "users", user.uid, "contacts", contact.id);
      const contactDoc = await getDoc(contactDocRef);

      if (contactDoc.exists()) {
          toast({ title: "Already a contact", description: `${contact.name} is already in your contacts.` });
          setAddingContactId(null);
          return;
      }
      
      const batch = writeBatch(db);
      batch.set(contactDocRef, { addedAt: serverTimestamp() });
      
      const currentUserContactDocRef = doc(db, "users", contact.id, "contacts", user.uid);
      batch.set(currentUserContactDocRef, { addedAt: serverTimestamp() });

      try {
        await batch.commit();
        toast({ title: "Contact Added", description: `You and ${contact.name} are now contacts.` });
      } catch (error) {
        console.error("Add contact error", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to add contact." });
      } finally {
        setAddingContactId(null);
      }
  };

  const usersToDisplay = allUsers.filter(u => !myContactIds.includes(u.id));

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
            {usersToDisplay.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {usersToDisplay.map((u) => (
                        <Card key={u.id}>
                            <CardContent className="flex flex-col items-center justify-center p-6">
                                <Avatar className="h-20 w-20 mb-4">
                                    <AvatarImage src={u.avatar} alt={u.name} />
                                    <AvatarFallback>{u.name.charAt(0)}</AvatarFallback>
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
                <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg">
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
