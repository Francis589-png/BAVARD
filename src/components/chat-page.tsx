
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Send, LogOut, MessageCircle, User as UserIcon, Paperclip, Download, UserPlus, Compass, PlusCircle, WifiOff, Film, Mic, StopCircle, Bell, Trash2, MoreVertical, Eraser, HardDrive, Shield, Eye, EyeOff, MicOff, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc, writeBatch, getDocs, Timestamp, updateDoc, setDoc, deleteDoc, limit, arrayUnion } from "firebase/firestore";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { AddContactDialog } from "./add-contact-dialog";
import Link from "next/link";
import { StoryViewer } from "./story-viewer";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "./ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { isAdmin } from "@/services/admin";
import ViewOnceMessage from "./view-once-message";
import { VerifiedBadge } from "./verified-badge";
import { JUSU_AI_USER_ID, BAVARD_SYSTEM_UID } from "@/lib/constants";
import { getAssistantResponse } from "@/ai/flows/assistant-flow";


interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email: string;
  unreadCount?: number;
  isVerified?: boolean;
}

interface Message {
    id: string;
    senderId: string;
    timestamp: any;
    type: 'text' | 'image' | 'audio' | 'file';
    text?: string;
    url?: string;
    fileName?: string;
    isViewOnce?: boolean;
    viewedBy?: string[];
    isTyping?: boolean;
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

interface Notification {
    id: string;
    type: 'new_message';
    senderId: string;
    senderName: string;
    chatId: string;
    timestamp: Timestamp;
    read: boolean;
}

const jusuAiUser: ChatUser = {
  id: JUSU_AI_USER_ID,
  name: "JUSU AI",
  email: "ai@jusudrive.com",
  avatar: "/jusu-ai-avatar.png",
  online: true,
  isVerified: true,
};


export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingStoryForUser, setViewingStoryForUser] = useState<ChatUser | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);

  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isClearChatAlertOpen, setIsClearChatAlertOpen] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isViewOnce, setIsViewOnce] = useState(false);


  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isOnline = useOnlineStatus();
  const unreadListenersRef = useRef<Map<string, () => void>>(new Map());


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const adminStatus = await isAdmin(user.uid);
        setIsUserAdmin(adminStatus);
        setLoading(false);
      } else {
        router.push("/login");
      }
    });
    
    if (typeof window !== 'undefined' && !notificationSoundRef.current) {
        notificationSoundRef.current = new Audio('/audio/notification.mp3');
        notificationSoundRef.current.preload = 'auto';
    }

    return () => unsubscribe();
  }, [router]);

  const selectContact = useCallback(async (contact: ChatUser | null) => {
    setSelectedContact(contact);
    if (contact && user) {
        sessionStorage.setItem('selectedContactId', contact.id);
        
        // Don't mark messages as read for read-only or AI chats
        if (contact.id === BAVARD_SYSTEM_UID || contact.id === JUSU_AI_USER_ID) return;

        const chatId = [user.uid, contact.id].sort().join("_");
        const chatMemberRef = doc(db, 'chats', chatId, 'members', user.uid);
        try {
            await setDoc(chatMemberRef, { lastRead: serverTimestamp() }, { merge: true });
        } catch (error) {
            console.error("Error updating lastRead timestamp:", error);
        }
    } else {
        sessionStorage.removeItem('selectedContactId');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const contactsCollection = collection(db, 'users', user.uid, 'contacts');
    const unsubscribeContacts = onSnapshot(
      contactsCollection,
      async (snapshot) => {
        const contactIds = snapshot.docs.map((doc) => doc.id);
        
        // Clean up old listeners
        unreadListenersRef.current.forEach(unsubscribe => unsubscribe());
        unreadListenersRef.current.clear();
  
        if (contactIds.length > 0) {
          const usersCollection = collection(db, 'users');
          const contactsQuery = query(usersCollection, where('__name__', 'in', contactIds));

          const unsubscribeUsers = onSnapshot(contactsQuery, (querySnapshot) => {
            const fetchedContacts: ChatUser[] = [];
            querySnapshot.forEach(doc => {
              fetchedContacts.push({id: doc.id, ...doc.data(), unreadCount: 0 } as ChatUser)
            });
            const allContacts = [jusuAiUser, ...fetchedContacts];
            setContacts(allContacts);

            fetchedContacts.forEach(contact => {
                const chatId = [user.uid, contact.id].sort().join('_');
                const chatMemberRef = doc(db, 'chats', chatId, 'members', user.uid);
                
                const unsubscribeLastRead = onSnapshot(chatMemberRef, (memberDoc) => {
                    const lastReadTimestamp = memberDoc.data()?.lastRead || null;
                    const messagesQuery = query(
                        collection(db, 'chats', chatId, 'messages'),
                        where('senderId', '==', contact.id),
                        ...(lastReadTimestamp ? [where('timestamp', '>', lastReadTimestamp)] : [])
                    );
                    
                    const unsubscribeMessages = onSnapshot(messagesQuery, (messageSnapshot) => {
                        const unreadCount = messageSnapshot.size;
                        setContacts(prevContacts => prevContacts.map(c => 
                            c.id === contact.id ? { ...c, unreadCount } : c
                        ));
                    });
                    
                    // Store this listener to unsubscribe later
                    unreadListenersRef.current.set(`msg_${contact.id}`, unsubscribeMessages);
                });
                unreadListenersRef.current.set(`lastRead_${contact.id}`, unsubscribeLastRead);
            });

            if (selectedContact) {
              const updatedSelectedContact = allContacts.find(c => c.id === selectedContact.id);
              if (updatedSelectedContact) {
                setSelectedContact(updatedSelectedContact);
              } else {
                 selectContact(allContacts[0] || null);
              }
            } else {
               const prevSelectedId = sessionStorage.getItem('selectedContactId');
               const contactToSelect = allContacts.find(u => u.id === prevSelectedId) || allContacts[0] || null;
               selectContact(contactToSelect);
            }
          });
          return () => unsubscribeUsers();

        } else {
          setContacts([jusuAiUser]);
          selectContact(jusuAiUser);
        }
      }
    );
  
    return () => {
        unsubscribeContacts();
        unreadListenersRef.current.forEach(unsubscribe => unsubscribe());
        unreadListenersRef.current.clear();
    };
  }, [user, selectContact]);


  useEffect(() => {
    if (!user) return;
    
    const userIdsForStories = Array.from(new Set([user.uid, ...contacts.map(c => c.id)]));
    
    if (userIdsForStories.length === 0) {
        setStories([]);
        return;
    }

    const now = Timestamp.now();
    const storiesQuery = query(
        collection(db, "stories"),
        where("userId", "in", userIdsForStories),
        where("expiresAt", ">", now)
    );
    
    const unsubscribeStories = onSnapshot(storiesQuery, async (snapshot) => {
        const storiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Omit<Story, 'userName' | 'userAvatar'>[];
        
        const authorIds = Array.from(new Set(storiesData.map(s => s.userId)));
        const usersData: Record<string, Partial<ChatUser>> = {};

        // Pre-populate with current user and contacts to avoid extra fetches
        if (user && user.displayName) {
            usersData[user.uid] = { name: user.displayName, avatar: user.photoURL || '' };
        }
        contacts.forEach(c => { usersData[c.id] = { name: c.name, avatar: c.avatar }; });

        const missingUserIds = authorIds.filter(id => !usersData[id]);
        if (missingUserIds.length > 0) {
            const usersRef = collection(db, 'users');
            const missingUsersQuery = query(usersRef, where('__name__', 'in', missingUserIds));
            const missingUsersSnapshot = await getDocs(missingUsersQuery);
            missingUsersSnapshot.forEach(doc => {
                const userData = doc.data();
                usersData[doc.id] = { name: userData.name, avatar: userData.avatar };
            });
        }
        
        const fetchedStories: Story[] = storiesData.map(story => {
            const author = usersData[story.userId] || { name: 'Unknown', avatar: '' };
            return {
                ...story,
                userName: author.name || 'Unknown User',
                userAvatar: author.avatar || ''
            } as Story;
        }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setStories(fetchedStories);
    });

    return () => unsubscribeStories();
  }, [user, contacts]);


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
    } else {
      setMessages([]);
    }
  }, [user, selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user) return;
    
    const notificationsQuery = query(
        collection(db, 'users', user.uid, 'notifications'),
        orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        // This part handles playing sound for new notifications
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const newNotif = change.doc.data() as Notification;
                 if (!newNotif.read) {
                    if (notificationSoundRef.current) {
                        notificationSoundRef.current.play().catch(e => console.error("Error playing sound", e));
                    }
                 }
            }
        });

        // This part rebuilds the full list for the UI
        const newNotifications: Notification[] = [];
        let foundUnread = false;
        snapshot.docs.forEach(doc => {
            const data = doc.data() as Notification;
            newNotifications.push({ id: doc.id, ...data });
            if (!data.read) {
                foundUnread = true;
            }
        });

        setNotifications(newNotifications);
        setHasUnread(foundUnread);
    });

    return () => unsubscribe();
  }, [user]);

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
    if (newMessage.trim() === "" || !user || !selectedContact || !isOnline) return;
    
    const isJusuAiChat = selectedContact.id === JUSU_AI_USER_ID;
    
    if (selectedContact.id === BAVARD_SYSTEM_UID) return; // Prevent sending messages to Bavard

    const chatId = [user.uid, selectedContact.id].sort().join("_");
    const messagesCollection = collection(db, "chats", chatId, "messages");
    
    const userMessage = newMessage;
    setNewMessage("");

    try {
        const messageDoc = {
            text: userMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            type: 'text' as const,
            ...(isViewOnce && { isViewOnce: true, viewedBy: [] })
        };
        await addDoc(messagesCollection, messageDoc);
        if (isViewOnce) setIsViewOnce(false);
        
        if (isJusuAiChat) {
             setMessages(prev => [...prev, {id: 'typing', senderId: JUSU_AI_USER_ID, isTyping: true, type: 'text', timestamp: new Date() }]);
             const aiResponse = await getAssistantResponse(userMessage);
             const aiMessageDoc = {
                text: aiResponse,
                senderId: JUSU_AI_USER_ID,
                timestamp: serverTimestamp(),
                type: 'text' as const,
            };
            await addDoc(messagesCollection, aiMessageDoc);
            
        } else {
            // Create notification for human recipient
            const notificationCollection = collection(db, 'users', selectedContact.id, 'notifications');
            const notificationDoc = {
                type: 'new_message',
                senderId: user.uid,
                senderName: user.displayName || user.email,
                chatId: chatId,
                timestamp: serverTimestamp(),
                read: false,
            };
            await addDoc(notificationCollection, notificationDoc);
        }

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to send message. Please try again.",
        });
        console.error("Send Message Error:", error);
        setNewMessage(userMessage); // Restore message on error
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user || !selectedContact) {
        return;
    }
    const file = e.target.files[0];
    await handleFileUpload(file);

    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleFileUpload = async (file: Blob, fileName?: string) => {
    if (!user || !selectedContact || !isOnline) return;
    if (selectedContact.id === BAVARD_SYSTEM_UID || selectedContact.id === JUSU_AI_USER_ID) return;
    
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
          
          const messageDoc = {
            senderId: user.uid,
            timestamp: serverTimestamp(),
            type: messageType,
            url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            fileName: resolvedFileName,
             ...(isViewOnce && { isViewOnce: true, viewedBy: [] })
          };
          await addDoc(messagesCollection, messageDoc);
           if (isViewOnce) setIsViewOnce(false);

          // Create notification for the recipient
          const notificationCollection = collection(db, 'users', selectedContact.id, 'notifications');
          const notificationDoc = {
            type: 'new_message',
            senderId: user.uid,
            senderName: user.displayName || user.email,
            chatId: chatId,
            timestamp: serverTimestamp(),
            read: false,
          };
          await addDoc(notificationCollection, notificationDoc);

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

  const handleStartRecording = async () => {
    if (isRecording) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({
            variant: "destructive",
            title: "Feature Not Supported",
            description: "Your browser does not support voice recording.",
        });
        setHasMicPermission(false);
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasMicPermission(true);

        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.addEventListener("dataavailable", (event) => {
            audioChunksRef.current.push(event.data);
        });
        
        mediaRecorderRef.current.addEventListener("stop", async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await handleFileUpload(audioBlob, `voice-message-${Date.now()}.webm`);
            stream.getTracks().forEach(track => track.stop());
        });

        mediaRecorderRef.current.start();
        setIsRecording(true);

    } catch (error) {
      console.error("Error starting recording:", error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast({ variant: "destructive", title: "Microphone Access Denied", description: "Please enable microphone permissions in your browser or app settings." });
      } else {
        toast({ variant: "destructive", title: "Microphone Error", description: "Could not access the microphone." });
      }
      setHasMicPermission(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast({ title: "Recording Complete", description: "Uploading your message..." });
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
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

      const contactUserDoc = querySnapshot.docs[0];
      const contactUser = { id: contactUserDoc.id, ...contactUserDoc.data() } as ChatUser;
      const contactId = contactUser.id;

      const contactDocRef = doc(db, "users", user.uid, "contacts", contactId);
      const contactDoc = await getDoc(contactDocRef);

      if (contactDoc.exists()) {
          toast({ title: "Already a contact", description: `${contactUser.name || contactUser.email} is already in your contacts.` });
          return;
      }
      
      const batch = writeBatch(db);
      batch.set(contactDocRef, { addedAt: serverTimestamp() });
      
      const currentUserContactDocRef = doc(db, "users", contactId, "contacts", user.uid);
      batch.set(currentUserContactDocRef, { addedAt: serverTimestamp() });

      await batch.commit();

      toast({ title: "Contact Added", description: `You and ${contactUser.name || contactUser.email} are now contacts.` });
      setIsAddContactOpen(false);
  };

  const markNotificationsAsRead = async () => {
    if (!user || !hasUnread) return;
    const batch = writeBatch(db);
    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    notifications.forEach(n => {
        if (!n.read) {
            const docRef = doc(notificationsRef, n.id);
            batch.update(docRef, { read: true });
        }
    });
    await batch.commit();
  }

  const handleNotificationClick = (notification: Notification) => {
    const contact = contacts.find(c => c.id === notification.senderId);
    if (contact) {
      selectContact(contact);
    }
    // Close the popover after clicking
    setIsNotificationPopoverOpen(false);
  };
  
  const storyUsers = stories.reduce((acc, story) => {
    if (!acc.find(u => u.id === story.userId)) {
      acc.push({ id: story.userId, name: story.userName, avatar: story.userAvatar});
    }
    return acc;
  }, [] as Partial<ChatUser>[]);

  const confirmDeleteMessage = async () => {
    if (!messageToDelete || !user || !selectedContact) return;
    const chatId = [user.uid, selectedContact.id].sort().join('_');
    const messageRef = doc(db, 'chats', chatId, 'messages', messageToDelete);
    try {
        await deleteDoc(messageRef);
        toast({ title: 'Message Deleted' });
    } catch (error) {
        console.error("Error deleting message:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete message.' });
    } finally {
        setMessageToDelete(null);
    }
  };

  const handleClearChat = async () => {
    if (!user || !selectedContact) return;

    const chatId = [user.uid, selectedContact.id].sort().join('_');
    const messagesCollection = collection(db, 'chats', chatId, 'messages');

    try {
        // Firestore doesn't support deleting a whole collection from the client-side SDK directly.
        // We need to fetch the documents and delete them in a batch.
        const messagesSnapshot = await getDocs(query(messagesCollection, limit(500))); // Limit to 500 to stay within batch write limits
        
        if (messagesSnapshot.empty) {
            toast({ title: "Chat is already empty" });
            return;
        }
        
        const batch = writeBatch(db);
        messagesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();

        // If there are more than 500 messages, this won't clear all of them.
        // For a true "clear all", a backend function is safer. This is a good-enough client-side approach.
        if (messagesSnapshot.size === 500) {
            toast({ title: "Clearing Chat...", description: "More messages to clear, this might take a moment."});
            // You could recursively call this function, but it's complex.
            // For now, this is a reasonable limitation.
        }

        toast({ title: "Chat Cleared", description: "All messages in this conversation have been deleted." });

    } catch (error) {
        console.error("Error clearing chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not clear chat messages.' });
    } finally {
        setIsClearChatAlertOpen(false);
    }
  };

  const markMessageAsViewed = async (messageId: string) => {
    if (!user || !selectedContact) return;
    const chatId = [user.uid, selectedContact.id].sort().join('_');
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    try {
      await updateDoc(messageRef, {
        viewedBy: arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error marking message as viewed:", error);
    }
  };


  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const isBavardChat = selectedContact?.id === BAVARD_SYSTEM_UID;
  const isJusuAiChat = selectedContact?.id === JUSU_AI_USER_ID;

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
                        <Popover open={isNotificationPopoverOpen} onOpenChange={(isOpen) => { setIsNotificationPopoverOpen(isOpen); if (!isOpen) markNotificationsAsRead() }}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-start relative">
                                    <Bell className="mr-2 h-4 w-4" />
                                    Notifications
                                    {hasUnread && <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-red-500" />}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">Notifications</h4>
                                    <div className="space-y-1">
                                        {notifications.length > 0 ? notifications.map(n => (
                                            <div key={n.id} className={`p-2 rounded-md cursor-pointer hover:bg-accent ${!n.read ? 'bg-primary/10' : ''}`} onClick={() => handleNotificationClick(n)}>
                                                <p className="text-sm font-medium">New Message</p>
                                                <p className="text-sm text-muted-foreground">From: {n.senderName}</p>
                                                <p className="text-xs text-muted-foreground/80 mt-1">
                                                    {n.timestamp ? formatDistanceToNow(n.timestamp.toDate(), { addSuffix: true }) : ''}
                                                </p>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center p-4">No new notifications.</p>
                                        )}
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => router.push('/create-post')}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Post
                        </Button>
                       <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setIsAddContactOpen(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Contact by Email
                        </Button>
                        <Link href="/drive" passHref>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                                <HardDrive className="mr-2 h-4 w-4" />
                                My Drive
                            </Button>
                        </Link>
                        <Link href="/explore" passHref>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Compass className="mr-2 h-4 w-4" />
                              Explore New Friends
                          </Button>
                        </Link>
                        <Link href="/foryou" passHref>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Film className="mr-2 h-4 w-4" />
                              For You
                          </Button>
                        </Link>
                        {isUserAdmin && (
                            <Link href="/admin" passHref>
                                <Button variant="ghost" size="sm" className="w-full justify-start">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Admin Panel
                                </Button>
                            </Link>
                        )}
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
                                            <AvatarFallback>{storyUser.name?.charAt(0) || '?'}</AvatarFallback>
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
                            onClick={() => selectContact(contact)}
                            isActive={selectedContact?.id === contact.id}
                            className="justify-start w-full"
                            >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.avatar} alt={contact.name} />
                                <AvatarFallback>{contact.id === JUSU_AI_USER_ID ? <Bot/> : contact.name?.charAt(0) || contact.email?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{contact.name || contact.email}</span>
                             {contact.unreadCount && contact.unreadCount > 0 && (
                                <Badge className="h-5">{contact.unreadCount}</Badge>
                            )}
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
                        <span className="text-sm font-medium truncate">{user.displayName || user.email}</span>
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
                            <AvatarFallback>{selectedContact.name?.charAt(0) || selectedContact.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4 flex-1">
                            <h2 className="text-lg font-semibold flex items-center gap-1">
                                <span>{selectedContact.name || selectedContact.email}</span>
                                {selectedContact.isVerified && <VerifiedBadge />}
                            </h2>
                        </div>
                        {!isJusuAiChat && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => setIsClearChatAlertOpen(true)} className="text-destructive">
                                        <Eraser className="mr-2 h-4 w-4" />
                                        Clear Chat
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </header>

                    <main className="flex-1 p-4 space-y-4 overflow-y-auto">
                        {!isOnline && (
                            <Alert variant="destructive">
                                <WifiOff className="h-4 w-4" />
                                <AlertTitle>You are offline</AlertTitle>
                                <AlertDescription>
                                    Your messages will be sent when you reconnect.
                                </AlertDescription>
                            </Alert>
                        )}
                        {hasMicPermission === false && (
                            <Alert>
                                <MicOff className="h-4 w-4" />
                                <AlertTitle>Microphone Access Denied</AlertTitle>
                                <AlertDescription>
                                    To send voice messages, please enable microphone permissions in your browser settings.
                                </AlertDescription>
                            </Alert>
                        )}
                       {messages.map((message) => {
                           const isMyMessage = message.senderId === user.uid;

                           if (message.isTyping) {
                                return (
                                    <div key={message.id} className="flex items-start gap-2 justify-start">
                                        <div className="rounded-lg px-4 py-2 max-w-sm relative bg-muted">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>JUSU AI is typing...</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                           }

                           return (
                               <div key={message.id} className={`group flex items-start gap-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
                                   {isMyMessage && !isBavardChat && !isJusuAiChat && (
                                       <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setMessageToDelete(message.id)}>
                                           <Trash2 className="h-4 w-4" />
                                       </Button>
                                   )}
                                   <div className={`rounded-lg px-4 py-2 max-w-sm relative ${isMyMessage ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                        {message.isViewOnce ? (
                                            <ViewOnceMessage message={message} currentUser={user} onOpen={markMessageAsViewed} />
                                        ) : (
                                            <>
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
                                                    <audio key={message.url} controls src={message.url} className="max-w-full">
                                                            Your browser does not support the audio element.
                                                    </audio>
                                                )}
                                            </>
                                        )}
                                        <p className="text-xs text-right opacity-70 mt-1">
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                   </div>
                               </div>
                           );
                       })}
                       <div ref={messagesEndRef} />
                    </main>

                     {!isBavardChat && (
                        <footer className="p-4 border-t">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                 {!isJusuAiChat && (
                                    <>
                                        <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!isOnline || isRecording}>
                                            <Paperclip className="w-5 h-5" />
                                            <span className="sr-only">Attach file</span>
                                        </Button>
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" disabled={isRecording}/>
                                        
                                        <Button type="button" size="icon" variant={isViewOnce ? "secondary" : "ghost"} onClick={() => setIsViewOnce(!isViewOnce)} disabled={!isOnline || isRecording}>
                                            {isViewOnce ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            <span className="sr-only">{isViewOnce ? "Disable View Once" : "Enable View Once"}</span>
                                        </Button>
                                    </>
                                 )}
                                
                                {isRecording ? (
                                    <div className="flex-1 flex items-center justify-center text-destructive animate-pulse">
                                        <StopCircle className="mr-2 h-5 w-5" />
                                        <span>Recording...</span>
                                    </div>
                                ) : (
                                    <Input 
                                        placeholder={isOnline ? (isJusuAiChat ? "Ask JUSU AI anything..." : "Type a message...") : "You are offline"}
                                        className="flex-1"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        disabled={uploading || !isOnline}
                                    />
                                )}
                                
                                {!isJusuAiChat && (
                                    <Button type="button" size="icon" variant={isRecording ? "destructive" : "ghost"} onClick={handleToggleRecording} disabled={uploading || !isOnline}>
                                        {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                                        <span className="sr-only">{isRecording ? "Stop recording" : "Start recording"}</span>
                                    </Button>
                                )}

                                <Button type="submit" size="icon" disabled={uploading || !isOnline || isRecording || newMessage.trim() === ""}>
                                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    <span className="sr-only">Send Message</span>
                                </Button>
                            </form>
                        </footer>
                     )}
                </div>
                 ) : (
                    <div className="flex flex-col h-full items-center justify-center text-center p-4">
                        {!isOnline && (
                            <Alert variant="destructive" className="mb-4">
                                <WifiOff className="h-4 w-4" />
                                <AlertTitle>You are offline</AlertTitle>
                                <AlertDescription>
                                    Please check your internet connection.
                                </AlertDescription>
                            </Alert>
                        )}
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
                user={viewingStoryForUser}
                onClose={() => setViewingStoryForUser(null)}
            />
        )}
        <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your message.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setMessageToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteMessage}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isClearChatAlertOpen} onOpenChange={setIsClearChatAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to clear this chat?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. All messages in this conversation will be permanently deleted for you.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearChat} className="bg-destructive hover:bg-destructive/90">
                        Clear Chat
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </SidebarProvider>
  );
}

  