
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { isAdmin, getAppStatistics, getAllUsers, updateUserStatus } from "@/services/admin";
import { Loader2, ShieldAlert, ArrowLeft, Users, FileText, HardDrive, MoreVertical, Search, ShieldCheck, Ban, CheckCircle, XCircle, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Input } from "./ui/input";
import Link from "next/link";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";


interface AppStats {
    totalUsers: number;
    totalPosts: number;
    totalStorageBytes: number;
}

interface AppUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
    isBanned?: boolean;
    isVerified?: boolean;
    createdAt?: {
        seconds: number;
        nanoseconds: number;
    };
}

type ActionType = "ban" | "unban" | "verify" | "unverify";

interface ActionAlertState {
    isOpen: boolean;
    user: AppUser | null;
    action: ActionType | null;
}

const MAX_STORAGE_BYTES = 20 * 1024 * 1024 * 1024;

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AppStats | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionAlert, setActionAlert] = useState<ActionAlertState>({ isOpen: false, user: null, action: null });

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.push('/login');
            return;
        }

        isAdmin(user.uid).then(auth => {
            if (auth) {
                setIsAuthorized(true);
                fetchAdminData();
            } else {
                setIsAuthorized(false);
                setLoading(false);
            }
        });

    }, [user, authLoading, router]);

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const [fetchedStats, fetchedUsers] = await Promise.all([
                getAppStatistics(),
                getAllUsers()
            ]);
            setStats(fetchedStats);
            setUsers(fetchedUsers as AppUser[]);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load admin data.' });
        } finally {
            setLoading(false);
        }
    };
    
    const handleActionClick = (user: AppUser, action: ActionType) => {
        setActionAlert({ isOpen: true, user, action });
    };
    
    const handleConfirmAction = async () => {
        if (!actionAlert.user || !actionAlert.action || !user) return;
        
        setIsSubmitting(true);
        const { user: targetUser, action } = actionAlert;

        try {
            const updates: Partial<AppUser> = {};
            if (action === 'ban') updates.isBanned = true;
            if (action === 'unban') updates.isBanned = false;
            if (action === 'verify') updates.isVerified = true;
            if (action === 'unverify') updates.isVerified = false;

            await updateUserStatus(user.uid, targetUser.id, updates);
            
            toast({ title: 'Success', description: `User ${targetUser.name} has been ${action}ned.` });
            
            // Update local state to reflect change immediately
            setUsers(prevUsers => prevUsers.map(u => 
                u.id === targetUser.id ? { ...u, ...updates } : u
            ));

        } catch (error) {
            console.error(`Failed to ${action} user:`, error);
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${action} user. Please try again.` });
        } finally {
            setIsSubmitting(false);
            setActionAlert({ isOpen: false, user: null, action: null });
        }
    };
    
    const handleStartChat = async (targetUser: AppUser) => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // Check if user is already a contact
            const contactRef = doc(db, 'users', user.uid, 'contacts', targetUser.id);
            const contactSnap = await getDoc(contactRef);

            if (!contactSnap.exists()) {
                // If not, add them
                const batch = writeBatch(db);
                batch.set(doc(db, 'users', user.uid, 'contacts', targetUser.id), { addedAt: serverTimestamp() });
                batch.set(doc(db, 'users', targetUser.id, 'contacts', user.uid), { addedAt: serverTimestamp() });
                await batch.commit();
                toast({ title: "Contact Added", description: `Started a new chat with ${targetUser.name}.` });
            }

            // Navigate to chat page and set the selected contact
            sessionStorage.setItem('selectedContactId', targetUser.id);
            router.push('/chat');

        } catch (error) {
            console.error("Error starting chat:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not start a chat with this user.' });
        } finally {
            setIsSubmitting(false);
        }
    };


    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (authLoading || loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">Loading Admin Panel...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col h-screen items-center justify-center text-center p-4">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
                <p className="mt-2 text-muted-foreground">You do not have permission to view this page.</p>
                <Button onClick={() => router.push('/')} className="mt-6">Go to Homepage</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-secondary">
             <AlertDialog open={actionAlert.isOpen} onOpenChange={(isOpen) => !isOpen && setActionAlert({ isOpen: false, user: null, action: null })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will {actionAlert.action} the user {actionAlert.user?.name}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirmAction} 
                            disabled={isSubmitting}
                            className={actionAlert.action === 'ban' || actionAlert.action === 'unverify' ? "bg-destructive hover:bg-destructive/90" : ""}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background p-4">
                <div className="flex items-center gap-4">
                    <Link href="/chat" passHref>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold">Admin Panel</h1>
                </div>
            </header>

            <main className="p-4 md:p-6 space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats?.totalPosts ?? 0}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Storage Used</CardTitle>
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatBytes(stats?.totalStorageBytes ?? 0)}</div>
                            <p className="text-xs text-muted-foreground">of {formatBytes(MAX_STORAGE_BYTES)} total</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>User Management</CardTitle>
                        <div className="relative mt-2">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                             <Input 
                                placeholder="Search users..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                             />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead className="hidden md:table-cell">Status</TableHead>
                                        <TableHead className="text-right hidden md:table-cell">Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(u => (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={u.avatar} />
                                                            <AvatarFallback>{u.name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{u.name}</div>
                                                            <div className="text-sm text-muted-foreground">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <div className="flex items-center gap-2">
                                                        {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                                                        {u.isVerified && <Badge variant="secondary" className="text-blue-500 border-blue-500">Verified</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                                                    {u.createdAt ? formatDistanceToNow(new Date(u.createdAt.seconds * 1000), { addSuffix: true }) : "N/A"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" disabled={isSubmitting}>
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                             <DropdownMenuItem onClick={() => handleStartChat(u)} disabled={u.id === user?.uid}>
                                                                <MessageCircle className="mr-2 h-4 w-4" /> Message
                                                            </DropdownMenuItem>
                                                            {u.isBanned ? (
                                                                <DropdownMenuItem onClick={() => handleActionClick(u, 'unban')}>
                                                                    <XCircle className="mr-2 h-4 w-4" /> Unban
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem className="text-destructive" onClick={() => handleActionClick(u, 'ban')}>
                                                                    <Ban className="mr-2 h-4 w-4" /> Ban
                                                                </DropdownMenuItem>
                                                            )}
                                                            {u.isVerified ? (
                                                                <DropdownMenuItem onClick={() => handleActionClick(u, 'unverify')}>
                                                                    <XCircle className="mr-2 h-4 w-4" /> Unverify
                                                                </DropdownMenuItem>
                                                            ) : (
                                                                <DropdownMenuItem onClick={() => handleActionClick(u, 'verify')}>
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Verify
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No users found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
