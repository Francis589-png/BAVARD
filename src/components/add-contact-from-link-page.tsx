
"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, writeBatch, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitingUser {
    id: string;
    name: string;
    avatar: string;
    email: string;
}

function AddContactFromLinkPageComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [invitingUser, setInvitingUser] = useState<InvitingUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const inviteUserId = searchParams.get('userId');

    useEffect(() => {
        if (!inviteUserId) {
            setError("No invitation link provided. Please ask your friend for a new link.");
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                if (user.uid === inviteUserId) {
                    setError("You cannot add yourself as a contact.");
                    setLoading(false);
                    return;
                }
                
                try {
                    const userDocRef = doc(db, "users", inviteUserId);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        setInvitingUser(userDoc.data() as InvitingUser);
                    } else {
                        setError("This invitation is invalid or the user does not exist.");
                    }
                } catch (e) {
                    console.error("Error fetching inviting user:", e);
                    setError("Could not retrieve invitation details.");
                } finally {
                    setLoading(false);
                }
            } else {
                // Not logged in, redirect to login but keep the invite info
                router.push(`/login?invite=${inviteUserId}`);
            }
        });

        return () => unsubscribe();

    }, [inviteUserId, router]);

    const handleAddContact = async () => {
        if (!currentUser || !invitingUser) return;
        setIsAdding(true);

        try {
            const currentUserContactsRef = doc(db, "users", currentUser.uid, "contacts", invitingUser.id);
            const contactDoc = await getDoc(currentUserContactsRef);

            if (contactDoc.exists()) {
                toast({ title: "Already a contact", description: `${invitingUser.name} is already in your contacts.` });
                router.push('/chat');
                return;
            }

            const batch = writeBatch(db);
            batch.set(currentUserContactsRef, { addedAt: serverTimestamp() });
            
            const invitingUserContactsRef = doc(db, "users", invitingUser.id, "contacts", currentUser.uid);
            batch.set(invitingUserContactsRef, { addedAt: serverTimestamp() });

            await batch.commit();
            toast({ title: "Contact Added!", description: `You and ${invitingUser.name} are now connected.` });
            router.push('/chat');

        } catch (err) {
            console.error("Failed to add contact:", err);
            toast({ variant: "destructive", title: "Error", description: "Failed to add contact. Please try again." });
        } finally {
            setIsAdding(false);
        }
    };
    
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
         <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 left-4"
                onClick={() => router.push('/chat')}
            >
                <ArrowLeft />
            </Button>
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                   {error ? (
                     <CardTitle>Invitation Error</CardTitle>
                   ) : (
                     <CardTitle>You're Invited!</CardTitle>
                   )}
                </CardHeader>
                <CardContent>
                    {error ? (
                        <p className="text-destructive text-center">{error}</p>
                    ) : invitingUser ? (
                       <div className="flex flex-col items-center gap-4">
                           <Avatar className="w-24 h-24">
                               <AvatarImage src={invitingUser.avatar} />
                               <AvatarFallback>{invitingUser.name?.charAt(0) || '?'}</AvatarFallback>
                           </Avatar>
                           <div className="text-center">
                               <p className="font-semibold">{invitingUser.name}</p>
                               <p className="text-sm text-muted-foreground">{invitingUser.email}</p>
                           </div>
                           <p className="text-sm text-center text-muted-foreground pt-4">
                             Connect with {invitingUser.name} to start chatting.
                           </p>
                       </div>
                    ) : null}
                </CardContent>
                <CardFooter>
                    {!error && invitingUser && (
                        <Button className="w-full" onClick={handleAddContact} disabled={isAdding}>
                            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                            Add {invitingUser.name}
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

export default function AddContactFromLinkPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <AddContactFromLinkPageComponent />
        </Suspense>
    )
}
