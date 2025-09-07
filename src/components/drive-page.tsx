
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, MessageCircle, HardDrive, Upload, File as FileIcon, MoreVertical, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, doc, deleteDoc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from 'date-fns';
import { uploadFile } from "@/ai/flows/pinata-flow";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";

interface DriveFile {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
    createdAt: any;
}

const MAX_STORAGE_GB = 20;
const MAX_STORAGE_BYTES = MAX_STORAGE_GB * 1024 * 1024 * 1024;

export default function DrivePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [totalSize, setTotalSize] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);

    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
            } else {
                router.push("/login");
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        const filesRef = collection(db, "users", user.uid, "files");
        const q = query(filesRef, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let currentSize = 0;
            const userFiles = snapshot.docs.map(doc => {
                const data = doc.data() as Omit<DriveFile, 'id'>;
                currentSize += data.size;
                return { id: doc.id, ...data };
            });
            setFiles(userFiles);
            setTotalSize(currentSize);
        });

        return () => unsubscribe();
    }, [user]);

    const handleFileUpload = useCallback(async (file: File) => {
        if (!user) return;
        if (totalSize + file.size > MAX_STORAGE_BYTES) {
            toast({ variant: "destructive", title: "Storage Limit Exceeded", description: `You cannot upload this file as it would exceed your ${MAX_STORAGE_GB}GB limit.` });
            return;
        }

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const dataUri = reader.result as string;
                try {
                    const ipfsHash = await uploadFile({ dataUri, fileName: file.name });
                    const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

                    const filesCollection = collection(db, 'users', user.uid, 'files');
                    await addDoc(filesCollection, {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        url: fileUrl,
                        createdAt: serverTimestamp(),
                    });

                    toast({ title: "File Uploaded", description: `${file.name} has been saved to your drive.` });
                } catch (error) {
                    console.error("Upload error:", error);
                    toast({ variant: "destructive", title: "Upload Error", description: "Failed to upload your file." });
                } finally {
                    setUploading(false);
                }
            };
        } catch (error) {
            console.error("File processing error:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not process the file." });
            setUploading(false);
        }
    }, [user, totalSize, toast]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    };
    
    const confirmDeleteFile = async () => {
        if (!fileToDelete || !user) return;

        try {
            await deleteDoc(doc(db, "users", user.uid, "files", fileToDelete.id));
            toast({ title: "File Deleted", description: `${fileToDelete.name} was removed from your drive.` });
        } catch (error) {
            console.error("Error deleting file:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not delete the file." });
        } finally {
            setFileToDelete(null);
        }
    };
    
    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    const storagePercentage = (totalSize / MAX_STORAGE_BYTES) * 100;

    return (
        <div className="min-h-screen bg-background text-foreground">
            <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{fileToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteFile} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
                <Link href="/chat" passHref>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <HardDrive className="w-8 h-8 text-primary" />
                    <h1 className="text-xl font-bold">My Drive</h1>
                </div>
            </header>

            <main className="p-4 md:p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Storage</CardTitle>
                        <CardDescription>
                            You have used {formatBytes(totalSize)} of your {MAX_STORAGE_GB} GB storage limit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Progress value={storagePercentage} className="h-4"/>
                        <p className="text-sm text-muted-foreground mt-2">{storagePercentage.toFixed(2)}% full</p>
                    </CardContent>
                </Card>

                <Card
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`transition-colors ${dragActive ? 'border-primary bg-primary/10' : ''}`}
                >
                    <CardContent className="p-6 text-center">
                        <form onSubmit={(e) => e.preventDefault()} className="relative">
                             <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={uploading}
                            />
                            <div className="border-2 border-dashed border-muted-foreground/50 rounded-lg p-10">
                                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                <p className="mt-2 text-muted-foreground">
                                    Drag & drop a file here, or{' '}
                                    <Button variant="link" className="p-0" onClick={() => fileInputRef.current?.click()}>
                                        click to browse
                                    </Button>
                                </p>
                                {uploading && (
                                    <div className="mt-4 flex items-center justify-center text-primary">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>Uploading...</span>
                                    </div>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>My Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="hidden md:table-cell">Date Added</TableHead>
                                    <TableHead className="text-right">Size</TableHead>
                                    <TableHead className="w-[50px]"><span className="sr-only">Actions</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.length > 0 ? (
                                    files.map(file => (
                                        <TableRow key={file.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <FileIcon className="h-4 w-4 text-muted-foreground" />
                                                <span className="truncate max-w-xs">{file.name}</span>
                                            </TableCell>
                                            <TableCell>{file.type}</TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {file.createdAt ? formatDistanceToNow(file.createdAt.toDate(), {addSuffix: true}) : 'Just now'}
                                            </TableCell>
                                            <TableCell className="text-right">{formatBytes(file.size)}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download
                                                            </a>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setFileToDelete(file)}>
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No files uploaded yet.
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
