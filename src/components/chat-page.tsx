
"use client";

import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Send, LogOut, MessageCircle, User as UserIcon } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc } from "firebase/firestore";

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
    text: string;
    timestamp: any;
}


export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);


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
    if (user) {
      const usersCollection = collection(db, "users");
      const q = query(usersCollection, where("id", "!=", user.uid));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const users: ChatUser[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            id: data.id,
            name: data.name,
            avatar: data.avatar,
            online: data.online, // This would need a presence system like RTDB
            email: data.email
          });
        });
        setContacts(users);
        if (!selectedContact && users.length > 0) {
            setSelectedContact(users[0]);
        }
      });
      return () => unsubscribe();
    }
  }, [user, selectedContact]);

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
                text: data.text,
                senderId: data.senderId,
                timestamp: data.timestamp?.toDate() ?? new Date()
            });
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
                             {/* {contact.online && <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />} */}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                    <div className="flex items-center gap-3">
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
                    </div>
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
                            {/* <p className="text-sm text-muted-foreground">{selectedContact.online ? 'Online' : 'Offline'}</p> */}
                        </div>
                    </header>

                    <main className="flex-1 p-4 space-y-4 overflow-y-auto">
                       {messages.map((message) => (
                           <div key={message.id} className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                               <div className={`rounded-lg px-4 py-2 max-w-sm ${message.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                   <p>{message.text}</p>
                                   <p className="text-xs text-right opacity-70 mt-1">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                               </div>
                           </div>
                       ))}
                       <div ref={messagesEndRef} />
                    </main>

                     <footer className="p-4 border-t">
                        <form onSubmit={handleSendMessage} className="relative">
                            <Input 
                                placeholder="Type a message..." 
                                className="pr-12"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                             />
                            <Button type="submit" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2">
                                <Send className="w-5 h-5" />
                            </Button>
                        </form>
                    </footer>
                </div>
                 ) : (
                    <div className="flex flex-col h-full items-center justify-center">
                        <MessageCircle className="w-24 h-24 text-muted-foreground" />
                        <h2 className="text-2xl font-semibold mt-4">Select a chat</h2>
                        <p className="text-muted-foreground mt-2">Choose a person from the sidebar to start a conversation.</p>
                    </div>
                )}
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
