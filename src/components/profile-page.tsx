
"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ArrowLeft, Camera, Share2, UserPlus, MessageCircle, Play, Trash2, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { doc, updateDoc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, deleteDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface ProfileUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
}

interface Post {
    id: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    title: string;
}

export default function ProfilePage({ userId }: { userId: string }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
    const [isMyProfile, setIsMyProfile] = useState(false);
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [contactCount, setContactCount] = useState(0);
    const [isContact, setIsContact] = useState(false);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [postToDelete, setPostToDelete] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        };

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // Fetch user data
                const userDocRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setProfileUser(userDoc.data() as ProfileUser);
                } else {
                    toast({ variant: 'destructive', title: 'User not found' });
                }

                 // Fetch user's posts
                const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId));
                const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
                    const userPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
                    setPosts(userPosts);
                });
                
                return () => unsubscribePosts();

            } catch (error) {
                console.error("Error fetching profile data: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load profile.' });
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();

    }, [userId, toast]);
    
     useEffect(() => {
        if (currentUser && userId) {
            setIsMyProfile(currentUser.uid === userId);

            // Fetch contact count
            const contactsRef = collection(db, "users", userId, "contacts");
            const unsubscribeCount = onSnapshot(contactsRef, (snapshot) => {
                setContactCount(snapshot.size);
            });
            
            // Check if profile user is a contact
            const contactDocRef = doc(db, "users", currentUser.uid, "contacts", userId);
            const unsubscribeIsContact = onSnapshot(contactDocRef, (doc) => {
                setIsContact(doc.exists());
            });

            return () => {
                unsubscribeCount();
                unsubscribeIsContact();
            };
        }
    }, [currentUser, userId]);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfilePicture = async () => {
        if (!imageFile || !currentUser) return;
        setUploading(true);

        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onload = async () => {
            const dataUri = reader.result as string;
            try {
                const ipfsHash = await uploadFile({ dataUri, fileName: imageFile.name });
                const newAvatarUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

                await updateProfile(currentUser, { photoURL: newAvatarUrl });
                const userDocRef = doc(db, 'users', currentUser.uid);
                await updateDoc(userDocRef, { avatar: newAvatarUrl });

                toast({ title: "Profile Updated!", description: "Your new profile picture is now set." });
                setProfileUser(prev => prev ? { ...prev, avatar: newAvatarUrl } : null);
                setImageFile(null);
                setImagePreview(null);
            } catch (error) {
                console.error('Profile update error:', error);
                toast({ variant: 'destructive', title: 'Update Error', description: 'Failed to update profile picture.' });
            } finally {
                setUploading(false);
            }
        };
    };

    const handleShareInvite = () => {
        if (!profileUser) return;
        const inviteLink = `${window.location.origin}/add-contact?userId=${profileUser.id}`;
        navigator.clipboard.writeText(inviteLink);
        toast({ title: "Link Copied!", description: `Invitation link for ${profileUser.name} copied!` });
    };

    const handleAddContact = async () => {
        if (!currentUser || !profileUser || isMyProfile) return;
        const batch = writeBatch(db);
        const currentUserContactRef = doc(db, "users", currentUser.uid, "contacts", profileUser.id);
        batch.set(currentUserContactRef, { addedAt: serverTimestamp() });
        const profileUserContactRef = doc(db, "users", profileUser.id, "contacts", currentUser.uid);
        batch.set(profileUserContactRef, { addedAt: serverTimestamp() });

        try {
            await batch.commit();
            toast({title: "Contact Added", description: `You and ${profileUser.name} are now contacts.`});
        } catch (error) {
            console.error("Error adding contact:", error);
            toast({variant: "destructive", title: "Error", description: "Could not add contact."});
        }
    };
    
    const handleChat = () => {
        if (!profileUser) return;
        router.push('/chat');
        sessionStorage.setItem('selectedContactId', profileUser.id);
    };

    const confirmDeletePost = async () => {
        if (!postToDelete) return;
        try {
            await deleteDoc(doc(db, "posts", postToDelete));
            toast({ title: "Post Deleted" });
            // The onSnapshot listener will automatically update the UI
        } catch (error) {
            console.error("Error deleting post:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the post." });
        } finally {
            setPostToDelete(null);
        }
    };


    if (loading || !profileUser) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <>
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-xl font-bold">{profileUser.name}</h1>
            </header>

            <main className="flex-1 overflow-y-auto">
                <div className="p-4 md:p-6">
                    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
                        <div className="relative">
                            <Avatar className="w-32 h-32 text-4xl border-4 border-background ring-2 ring-primary">
                                <AvatarImage src={imagePreview || profileUser.avatar} alt={profileUser.name} />
                                <AvatarFallback>{profileUser.name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            {isMyProfile && (
                                <>
                                <Button size="icon" className="absolute bottom-1 right-1 rounded-full" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="w-5 h-5"/>
                                <span className="sr-only">Change picture</span>
                                </Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                </>
                            )}
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <CardTitle className="text-3xl">{profileUser.name}</CardTitle>
                            <CardDescription>{profileUser.email}</CardDescription>
                            <div className="flex justify-center md:justify-start gap-4 mt-4">
                                <div>
                                    <p className="font-bold text-lg">{posts.length}</p>
                                    <p className="text-sm text-muted-foreground">Posts</p>
                                </div>
                                <div>
                                    <p className="font-bold text-lg">{contactCount}</p>
                                    <p className="text-sm text-muted-foreground">Contacts</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                         {isMyProfile ? (
                            <>
                            {imageFile && (
                                <Button className="w-full sm:w-auto" onClick={handleUpdateProfilePicture} disabled={uploading}>
                                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                    Save Picture
                                </Button>
                            )}
                            <Button className="w-full sm:w-auto" variant="outline" onClick={handleShareInvite}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Invite Link
                            </Button>
                            </>
                         ) : (
                           <>
                            {isContact ? (
                                <Button className="w-full sm:w-auto" onClick={handleChat}>
                                    <MessageCircle className="mr-2 h-4 w-4" /> Message
                                </Button>
                            ) : (
                                <Button className="w-full sm:w-auto" onClick={handleAddContact}>
                                    <UserPlus className="mr-2 h-4 w-4" /> Add Contact
                                </Button>
                            )}
                           </>
                         )}
                    </div>
                </div>

                <Separator className="my-6" />

                <div className="p-4 md:p-6">
                    <h2 className="text-xl font-bold mb-4">Posts</h2>
                    {posts.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1">
                            {posts.map(post => (
                                <div key={post.id} className="group relative aspect-square w-full bg-muted overflow-hidden rounded-md">
                                    <Image src={post.mediaUrl} alt={post.title || ''} layout="fill" objectFit="cover" />
                                     {post.mediaType === 'video' && (
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <Play className="h-8 w-8 text-white" />
                                        </div>
                                    )}
                                    {isMyProfile && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-8 w-8 text-white bg-black/30 hover:bg-black/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem className="text-destructive" onClick={() => setPostToDelete(post.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4"/>
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">{isMyProfile ? "You haven't" : `${profileUser.name} hasn't`} posted anything yet.</p>
                    )}
                </div>
            </main>
        </div>
        <AlertDialog open={!!postToDelete} onOpenChange={(open) => !open && setPostToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this post.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeletePost} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
