
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
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

// Dummy data for now
const contacts = [
  { id: "2", name: "Jane Doe", avatar: "https://i.pravatar.cc/150?u=jane", online: true },
  { id: "3", name: "Peter Jones", avatar: "https://i.pravatar.cc/150?u=peter", online: false },
  { id: "4", name: "Mary Smith", avatar: "https://i.pravatar.cc/150?u=mary", online: true },
];

const messages = [
    { id: "1", senderId: "2", text: "Hey! How are you?", timestamp: new Date(Date.now() - 1000 * 60 * 5) },
    { id: "2", senderId: "1", text: "I'm good, thanks! How about you?", timestamp: new Date(Date.now() - 1000 * 60 * 4) },
    { id: "3", senderId: "2", text: "Doing great. Just working on this chat app.", timestamp: new Date(Date.now() - 1000 * 60 * 3) },
];


export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState(contacts[0]);
  const router = useRouter();
  const { toast } = useToast();

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
                            isActive={selectedContact.id === contact.id}
                            className="justify-start w-full"
                            >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={contact.avatar} alt={contact.name} />
                                <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{contact.name}</span>
                             {contact.online && <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />}
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
                <div className="flex flex-col h-full">
                    <header className="flex items-center p-4 border-b">
                         <SidebarTrigger className="md:hidden" />
                         <Avatar className="h-10 w-10">
                            <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
                            <AvatarFallback>{selectedContact.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="ml-4">
                            <h2 className="text-lg font-semibold">{selectedContact.name}</h2>
                            <p className="text-sm text-muted-foreground">{selectedContact.online ? 'Online' : 'Offline'}</p>
                        </div>
                    </header>

                    <main className="flex-1 p-4 space-y-4 overflow-y-auto">
                       {messages.map((message) => (
                           <div key={message.id} className={`flex ${message.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                               <div className={`rounded-lg px-4 py-2 max-w-sm ${message.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                   <p>{message.text}</p>
                                   <p className="text-xs text-right opacity-70 mt-1">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                               </div>
                           </div>
                       ))}
                    </main>

                     <footer className="p-4 border-t">
                        <div className="relative">
                            <Input placeholder="Type a message..." className="pr-12" />
                            <Button size="icon" className="absolute top-1/2 right-2 -translate-y-1/2">
                                <Send className="w-5 h-5" />
                            </Button>
                        </div>
                    </footer>
                </div>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
