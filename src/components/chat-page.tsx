
"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Send, LogOut, MessageCircle, User as UserIcon, Paperclip, Mic, Download, UserPlus, Compass, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, writeBatch, getDocs, Timestamp } from "firebase/firestore";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { AddContactDialog } from "./add-contact-dialog";
import Link from "next/link";
import { StoryViewer } from "./story-viewer";

interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email: string;
}

interface Message {
    id: string;
    senderId: string;
    timestamp: any;
    type: 'text' | 'image' | 'audio' | 'file';
    text?: string;
    url?: string;
    fileName?: string;
}

interface Story {
    id: string;
    userId: string;
    mediaUrl: string;
    mediaType: 'image';
    createdAt: Timestamp;
    expiresAt: Timestamp;
    userAvatar: string;
    userName: string;
}


export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStoryForUser, setViewingStoryForUser] = useState<ChatUser | null>(null);


  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

    useEffect(() => {
        if (!user) return;

        const contactsCollection = collection(db, "users", user.uid, "contacts");
        const unsubscribeContacts = onSnapshot(contactsCollection, async (snapshot) => {
            const contactIds = snapshot.docs.map(doc => doc.id);

            if (contactIds.length > 0) {
                const usersCollection = collection(db, "users");
                const qUsers = query(usersCollection, where("id", "in", contactIds));
                
                onSnapshot(qUsers, (querySnapshot) => {
                    const fetchedContacts: ChatUser[] = [];
                    querySnapshot.forEach((doc) => {
                        const data = doc.data();
                        fetchedContacts.push({
                          id: data.id,
                          name: data.name,
                          avatar: data.avatar,
                          online: data.online,
                          email: data.email
                        });
                    });
                    setContacts(fetchedContacts);

                    if (!selectedContact || !contactIds.includes(selectedContact.id)) {
                        const prevSelectedId = sessionStorage.getItem('selectedContactId');
                        const contactToSelect = fetchedContacts.find(u => u.id === prevSelectedId) || fetchedContacts[0] || null;
                        setSelectedContact(contactToSelect);
                    }
                });
            } else {
                setContacts([]);
                setSelectedContact(null);
            }
        });
        
        return () => unsubscribeContacts();
    }, [user, selectedContact]);


  useEffect(() => {
    if (!user) return;

    const allUserIds = Array.from(new Set([user.uid, ...contacts.map(c => c.id)]));
    if (allUserIds.length === 0) {
        setStories([]);
        return;
    }

    const now = Timestamp.now();
    const unsubscribes = allUserIds.map(userId => {
        const storiesCollection = collection(db, "stories");
        const qStories = query(
            storiesCollection,
            where("userId", "==", userId),
            where("expiresAt", ">", now)
        );

        return onSnapshot(qStories, async (snapshot) => {
            const fetchedStories: Story[] = [];
             for (const storyDoc of snapshot.docs) {
                const storyData = storyDoc.data();
                let storyUser;

                if (storyData.userId === user.uid) {
                    storyUser = { id: user.uid, name: "You", avatar: user.photoURL || '' };
                } else {
                    const contact = contacts.find(c => c.id === storyData.userId);
                    storyUser = contact || { id: storyData.userId, name: 'Unknown', avatar: '' };
                }
                
                fetchedStories.push({
                    id: storyDoc.id,
                    ...storyData,
                    userAvatar: storyUser.avatar,
                    userName: storyUser.name,
                } as Story);
            }
            
            setStories(prevStories => {
                // Filter out old stories from this user
                const otherStories = prevStories.filter(s => s.userId !== userId);
                // Combine with new stories
                const newStories = [...otherStories, ...fetchedStories];
                // Sort
                return newStories.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            });
        });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [user, contacts]);


   useEffect(() => {
    if (selectedContact) {
      sessionStorage.setItem('selectedContactId', selectedContact.id);
    }
   }, [selectedContact]);

  useEffect(() => {
    if (user && selectedContact) {
      const chatId = [user.uid, selectedContact.id].sort().join("_");
      const messagesCollection = collection(db, "chats", chatId, "messages");
      const q = query(messagesCollection, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const msgs: Message[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            msgs.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate() ?? new Date()
            } as Message);
        });
        setMessages(msgs);
      });
      return () => unsubscribe();
    }
  }, [user, selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      router.push("/login");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sign out. Please try again.",
      });
      console.error("Sign Out Error:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !user || !selectedContact) return;

    const chatId = [user.uid, selectedContact.id].sort().join("_");
    const messagesCollection = collection(db, "chats", chatId, "messages");

    try {
        await addDoc(messagesCollection, {
            text: newMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            type: 'text',
        });
        setNewMessage("");
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to send message. Please try again.",
        });
        console.error("Send Message Error:", error);
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user || !selectedContact) {
        return;
    }
    const file = e.target.files[0];
    await handleFileUpload(file);

    // Reset file input
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleFileUpload = async (file: Blob, fileName?: string) => {
    if (!user || !selectedContact) return;
    
    setUploading(true);
    const resolvedFileName = fileName || (file instanceof File ? file.name : `audio-message-${Date.now()}.webm`);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const dataUri = reader.result as string;
        try {
          const ipfsHash = await uploadFile({ dataUri, fileName: resolvedFileName });
          const isImage = file.type.startsWith('image/');
          const isAudio = file.type.startsWith('audio/');
          let messageType: Message['type'] = 'file';
          if (isImage) messageType = 'image';
          if (isAudio) messageType = 'audio';

          const chatId = [user.uid, selectedContact.id].sort().join('_');
          const messagesCollection = collection(db, 'chats', chatId, 'messages');

          await addDoc(messagesCollection, {
            senderId: user.uid,
            timestamp: serverTimestamp(),
            type: messageType,
            url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            fileName: resolvedFileName,
          });
        } catch (error) {
          console.error('File upload error:', error);
          toast({
            variant: 'destructive',
            title: 'Upload Error',
            description: 'Failed to upload file to Pinata.',
          });
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = (error) => {
        console.error('File reader error:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to read file.',
        });
        setUploading(false);
      };
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred while processing the file.',
      });
      setUploading(false);
    }
  };


  const handleAddContact = async (contactEmail: string) => {
      if (!user) return;
      if (contactEmail === user.email) {
          toast({ variant: "destructive", title: "Error", description: "You cannot add yourself as a contact." });
          return;
      }

      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", contactEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
          toast({ variant: "destructive", title: "Not Found", description: "No user found with that email." });
          return;
      }

      const contactUser = querySnapshot.docs[0].data() as ChatUser;
      const contactId = contactUser.id;

      // Add to current user's contacts
      const contactDocRef = doc(db, "users", user.uid, "contacts", contactId);
      const contactDoc = await getDoc(contactDocRef);

      if (contactDoc.exists()) {
          toast({ title: "Already a contact", description: `${contactUser.name} is already in your contacts.` });
          return;
      }
      
      const batch = writeBatch(db);
      batch.set(contactDocRef, { addedAt: serverTimestamp() });
      
      // Also add current user to the new contact's list to make it reciprocal
      const currentUserContactDocRef = doc(db, "users", contactId, "contacts", user.uid);
      batch.set(currentUserContactDocRef, { addedAt: serverTimestamp() });

      await batch.commit();

      toast({ title: "Contact Added", description: `You and ${contactUser.name} are now contacts.` });
      setIsAddContactOpen(false);
  };
  
  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await handleFileUpload(audioBlob, `voice-message-${Date.now()}.webm`);
            // Clean up stream tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        toast({ title: "Recording started..." });
    } catch (error) {
        console.error("Error accessing microphone:", error);
        toast({ variant: "destructive", title: "Microphone Error", description: "Could not access microphone. Please check permissions." });
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          toast({ title: "Recording stopped, uploading..." });
      }
  };

  const storyUsers = stories.reduce((acc, story) => {
    if (!acc.find(u => u.id === story.userId)) {
      acc.push({ id: story.userId, name: story.userName, avatar: story.userAvatar});
    }
    return acc;
  }, [] as Partial<ChatUser>[]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
        <div className="flex h-screen bg-background text-foreground">
             <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-8 h-8 text-primary" />
                        <h1 className="text-xl font-bold">BAVARD</h1>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                       <SidebarGroupLabel>Actions</SidebarGroupLabel>
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => router.push('/story/create')}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add to Story
                        </Button>
                       <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setIsAddContactOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Contact by Email
                        </Button>
                        <Link href="/explore" passHref>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Compass className="mr-2 h-4 w-4" />
                              Explore New Friends
                          </Button>
                        </Link>
                    </SidebarGroup>
                    <SidebarSeparator />
                     {storyUsers.length > 0 && (
                        <SidebarGroup>
                            <SidebarGroupLabel>Stories</SidebarGroupLabel>
                            <div className="flex gap-4 px-2 overflow-x-auto pb-2">
                                {storyUsers.map(storyUser => (
                                    <div key={storyUser.id} className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => setViewingStoryForUser(storyUser as ChatUser)}>
                                        <Avatar className="h-12 w-12 border-2 border-primary">
                                            <AvatarImage src={storyUser.avatar} />
                                            <AvatarFallback>{storyUser.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs w-14 truncate text-center">{storyUser.name}</span>
                                    </div>
                                ))}
                            </div>
                        </SidebarGroup>
                     )}
                    <SidebarGroup>
                       <SidebarGroupLabel>Contacts</SidebarGroupLabel>
                    </SidebarGroup>
                    <SidebarMenu>
                        {contacts.map((contact) => (
                        <SidebarMenuItem key={contact.id}>
                            <SidebarMenuButton
                            onClick={() => setSelectedContact(contact)}
                            isActive={selectedContact?.id === contact.id}
                            className="justify-start w-full"
                            >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.avatar} alt={contact.name} />
                                <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{contact.name}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                    <Link href="/profile" className="flex items-center gap-3 hover:bg-muted p-2 rounded-md transition-colors">
                         <Avatar className="h-8 w-8">
                            <AvatarImage src={user.photoURL ?? undefined} />
                            <AvatarFallback>
                               {user.email?.charAt(0).toUpperCase() ?? <UserIcon />}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{user.email}</span>
                        <Button onClick={handleSignOut} variant="ghost" size="icon" className="ml-auto">
                            <LogOut className="w-5 h-5"/>
                        </Button>
                    </Link>
                </SidebarFooter>
            </Sidebar>

            <SidebarInset>
             {selectedContact ? (
                <div className="flex flex-col h-full">
                    <header className="flex items-center p-4 border-b">
                         <SidebarTrigger className="md:hidden" />
                         <Avatar className="h-10 w-10">
                            <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                            <AvatarFallback>{selectedContact.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                            <h2 className="text-lg font-semibold">{selectedContact.name}</h2>
                        </div>
                    </header>

                    <main className="flex-1 p-4 space-y-4 overflow-y-auto">
                       {messages.map((message) => (
                           <div key={message.id} className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                               <div className={`rounded-lg px-4 py-2 max-w-sm ${message.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                   {message.type === 'text' && <p>{message.text}</p>}
                                   {message.type === 'image' && message.url && (
                                       <Image src={message.url} alt={message.fileName || 'Image'} width={300} height={300} className="rounded-md object-cover"/>
                                   )}
                                   {message.type === 'file' && message.url && (
                                       <a href={message.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                                          <Download className="w-4 h-4"/>
                                          <span>{message.fileName || 'Download File'}</span>
                                       </a>
                                   )}
                                    {message.type === 'audio' && message.url && (
                                        <audio controls src={message.url} className="w-full" />
                                   )}
                                   <p className="text-xs text-right opacity-70 mt-1">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                               </div>
                           </div>
                       ))}
                       <div ref={messagesEndRef} />
                    </main>

                     <footer className="p-4 border-t">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                             <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                                <Paperclip className="w-5 h-5" />
                                <span className="sr-only">Attach file</span>
                            </Button>
                             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                             <Button 
                                type="button" 
                                size="icon" 
                                variant={isRecording ? "destructive" : "ghost"}
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onTouchStart={startRecording}
                                onTouchEnd={stopRecording}
                            >
                                <Mic className="w-5 h-5" />
                                <span className="sr-only">Record voice message</span>
                            </Button>
                            <Input 
                                placeholder="Type a message..." 
                                className="flex-1"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                disabled={uploading || isRecording}
                             />
                            <Button type="submit" size="icon" disabled={uploading || isRecording}>
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </Button>
                        </form>
                    </footer>
                </div>
                 ) : (
                    <div className="flex flex-col h-full items-center justify-center text-center p-4">
                        <MessageCircle className="w-24 h-24 text-muted-foreground" />
                        <h2 className="text-2xl font-semibold mt-4">Select a contact to start chatting</h2>
                        <p className="text-muted-foreground mt-2">
                          {contacts.length > 0
                            ? "Choose someone from your contacts list."
                            : "You don't have any contacts yet. Add one by email or explore to find new friends."}
                        </p>
                    </div>
                )}
            </SidebarInset>
        </div>
        <AddContactDialog
            isOpen={isAddContactOpen}
            onOpenChange={setIsAddContactOpen}
            onAddContact={handleAddContact}
        />
        {viewingStoryForUser && (
            <StoryViewer 
                stories={stories.filter(s => s.userId === viewingStoryForUser.id)}
                onClose={() => setViewingStoryForUser(null)}
            />
        )}
    </SidebarProvider>
  );
}

    

    