
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { isAdmin, getAppStatistics, getAllUsers } from "@/services/admin";
import { Loader2, ShieldAlert, ArrowLeft, Users, FileText, HardDrive, MoreVertical, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Input } from "./ui/input";
import Link from "next/link";
import { Button } from "./ui/button";

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
    createdAt?: {
        seconds: number;
        nanoseconds: number;
    };
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

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<AppStats | null>(null);
    const [users, setUsers] = useState<AppUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

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
            const [fetchedStats, fetchedUsers] = await Promise.all([
                getAppStatistics(),
                getAllUsers()
            ]);
            setStats(fetchedStats);
            setUsers(fetchedUsers);
        } catch (error) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setLoading(false);
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
                                        <TableHead className="hidden md:table-cell">Email</TableHead>
                                        <TableHead className="hidden lg:table-cell">UID</TableHead>
                                        <TableHead className="text-right">Joined</TableHead>
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
                                                        <span className="font-medium">{u.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">{u.email}</TableCell>
                                                <TableCell className="hidden lg:table-cell text-muted-foreground">{u.id}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    {u.createdAt ? formatDistanceToNow(new Date(u.createdAt.seconds * 1000), { addSuffix: true }) : "N/A"}
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

