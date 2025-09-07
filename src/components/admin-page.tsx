
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { isAdmin, getAppStatistics, getAllUsers, updateUserStatus, getReports, sendBavardMessage, getVerificationRequests, processVerificationRequest } from "@/services/admin";
import { Loader2, ShieldAlert, ArrowLeft, Users, FileText, HardDrive, MoreVertical, Search, ShieldCheck, Ban, CheckCircle, XCircle, MessageCircle, Flag, Send, FileCheck2, UserCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Input } from "./ui/input";
import Link from "next/link";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "./ui/badge";
import { doc, getDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { VerifiedBadge } from "./verified-badge";
import { BavardMessageDialog } from "./bavard-message-dialog";


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
    createdAt?: string; // Changed from timestamp object to string
}

interface Report {
    id: string;
    postId: string;
    reportedBy: string;
    reason: string;
    createdAt: string; // Changed from timestamp object to string
    post: {
        id: string;
        title: string;
        mediaUrl: string;
        mediaType: 'image' | 'video';
    } | null;
    reportedBy_User: AppUser | null;
    postAuthor: AppUser | null;
}

interface VerificationRequest {
    id: string;
    userId: string;
    idPhotoUrl: string;
    selfieUrl: string;
    status: 'pending';
    createdAt: string; // Changed from timestamp object to string
    user: AppUser;
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
    const [reports, setReports] = useState<Report[]>([]);
    const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionAlert, setActionAlert] = useState<ActionAlertState>({ isOpen: false, user: null, action: null });
    
    const [isBavardMessageOpen, setIsBavardMessageOpen] = useState(false);
    const [bavardMessageUser, setBavardMessageUser] = useState<AppUser | null>(null);


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
            const [fetchedStats, fetchedUsers, fetchedReports, fetchedRequests] = await Promise.all([
                getAppStatistics(),
                getAllUsers(),
                getReports(),
                getVerificationRequests(),
            ]);
            setStats(fetchedStats);
            setUsers(fetchedUsers as AppUser[]);
            setReports(fetchedReports as Report[]);
            setVerificationRequests(fetchedRequests as VerificationRequest[]);
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
    
    const handleProcessRequest = async (request: VerificationRequest, status: 'approve' | 'reject') => {
        if (!user) return;
        
        setIsSubmitting(true);
        try {
            await processVerificationRequest(user.uid, request.userId, status);
            toast({ title: "Success", description: `Request for ${request.user.name} has been ${status}d.`});
            
            // Optimistically update UI
            setVerificationRequests(prev => prev.filter(r => r.id !== request.id));
            if (status === 'approve') {
                setUsers(prev => prev.map(u => u.id === request.userId ? {...u, isVerified: true} : u));
            }

        } catch (error) {
            console.error("Failed to process request:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not process the request."});
        } finally {
            setIsSubmitting(false);
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

    const handleOpenBavardMessageDialog = (targetUser: AppUser) => {
        setBavardMessageUser(targetUser);
        setIsBavardMessageOpen(true);
    };

    const handleSendBavardMessage = async (message: string) => {
        if (!user || !bavardMessageUser) return;
        try {
            await sendBavardMessage(user.uid, bavardMessageUser.id, message);
            toast({ title: "Message Sent", description: `Official message sent to ${bavardMessageUser.name}.` });
        } catch (error: any) {
            console.error("Error sending Bavard message:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not send the message.' });
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
            
            <BavardMessageDialog
                isOpen={isBavardMessageOpen}
                onOpenChange={setIsBavardMessageOpen}
                onSendMessage={handleSendBavardMessage}
                userName={bavardMessageUser?.name || null}
            />


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
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                            <CardTitle className="text-sm font-medium">Verification Requests</CardTitle>
                             <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{verificationRequests.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Reports</CardTitle>
                            <Flag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{reports.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatBytes(stats?.totalStorageBytes ?? 0)}</div>
                            <p className="text-xs text-muted-foreground">of {formatBytes(MAX_STORAGE_BYTES)}</p>
                        </CardContent>
                    </Card>
                </div>
                
                <Tabs defaultValue="users">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="users">User Management</TabsTrigger>
                        <TabsTrigger value="requests">Verification Requests</TabsTrigger>
                        <TabsTrigger value="reports">Content Reports</TabsTrigger>
                    </TabsList>
                    <TabsContent value="users">
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
                                                                    <div className="font-medium flex items-center gap-1.5">
                                                                        <span>{u.name}</span>
                                                                        {u.isVerified && <VerifiedBadge />}
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground">{u.email}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell">
                                                            <div className="flex items-center gap-2">
                                                                {u.isBanned && <Badge variant="destructive">Banned</Badge>}
                                                                {!u.isBanned && u.isVerified && <Badge variant="secondary" className="border-blue-500 text-blue-500">Verified</Badge>}
                                                                {!u.isBanned && !u.isVerified && <Badge variant="outline">Active</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                                                            {u.createdAt ? formatDistanceToNow(new Date(u.createdAt), { addSuffix: true }) : "N/A"}
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
                                                                     <DropdownMenuItem onClick={() => handleOpenBavardMessageDialog(u)}>
                                                                        <Send className="mr-2 h-4 w-4" /> Message from BAVARD
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
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
                    </TabsContent>
                    <TabsContent value="requests">
                        <Card>
                            <CardHeader>
                                <CardTitle>Verification Requests</CardTitle>
                            </CardHeader>
                             <CardContent>
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Documents</TableHead>
                                                <TableHead className="text-right">Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {verificationRequests.length > 0 ? (
                                                verificationRequests.map(req => (
                                                    <TableRow key={req.id}>
                                                        <TableCell>
                                                            <Link href={`/profile/${req.user.id}`} className="flex items-center gap-3 hover:underline">
                                                                <Avatar>
                                                                    <AvatarImage src={req.user.avatar} />
                                                                    <AvatarFallback>{req.user.name?.[0]}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-medium">{req.user.name}</div>
                                                                    <div className="text-sm text-muted-foreground">{req.user.email}</div>
                                                                </div>
                                                            </Link>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-2">
                                                                <a href={req.idPhotoUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm">ID Photo <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                                <a href={req.selfieUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm">Selfie <ExternalLink className="ml-2 h-3 w-3"/></Button></a>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-muted-foreground">
                                                            {req.createdAt ? formatDistanceToNow(new Date(req.createdAt), { addSuffix: true }) : "N/A"}
                                                        </TableCell>
                                                         <TableCell className="text-right">
                                                            <div className="flex gap-2 justify-end">
                                                                <Button size="sm" variant="destructive" onClick={() => handleProcessRequest(req, 'reject')} disabled={isSubmitting}>Reject</Button>
                                                                <Button size="sm" onClick={() => handleProcessRequest(req, 'approve')} disabled={isSubmitting}>Approve</Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center">
                                                        No pending verification requests.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="reports">
                        <Card>
                            <CardHeader>
                                <CardTitle>Content Reports</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-lg">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Reported Post</TableHead>
                                                <TableHead>Post Author</TableHead>
                                                <TableHead>Reported By</TableHead>
                                                <TableHead className="text-right">Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reports.length > 0 ? (
                                                reports.map(report => (
                                                    <TableRow key={report.id}>
                                                        <TableCell>
                                                             {report.post ? (
                                                                <Link href="/foryou" className="hover:underline flex items-center gap-2">
                                                                    {report.post.mediaType === 'image' ? (
                                                                        <img src={report.post.mediaUrl} alt={report.post.title} className="w-10 h-10 object-cover rounded-md"/>
                                                                    ) : (
                                                                        <video src={report.post.mediaUrl} className="w-10 h-10 object-cover rounded-md" />
                                                                    )}
                                                                    <span>{report.post.title || 'Untitled Post'}</span>
                                                                </Link>
                                                            ) : (
                                                                <span className="text-muted-foreground">Post Deleted</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {report.postAuthor ? (
                                                                <Link href={`/profile/${report.postAuthor.id}`} className="hover:underline">{report.postAuthor.name}</Link>
                                                            ) : (
                                                                <span className="text-muted-foreground">User Deleted</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {report.reportedBy_User ? (
                                                                <Link href={`/profile/${report.reportedBy_User.id}`} className="hover:underline">{report.reportedBy_User.name}</Link>
                                                            ) : (
                                                                <span className="text-muted-foreground">User Deleted</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {report.createdAt ? formatDistanceToNow(new Date(report.createdAt), { addSuffix: true }) : 'N/A'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center">
                                                        No reports found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
