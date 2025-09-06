
"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ArrowLeft, Image as ImageIcon, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { Textarea } from "./ui/textarea";

export default function CreateStoryPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState("");
    const [uploadType, setUploadType] = useState<'image' | 'video' | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUser(user);
            } else {
                router.push("/login");
            }
            setLoadingUser(false);
        });
        return () => unsubscribe();
    }, [router]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            
            const fileType = selectedFile.type.split('/')[0];
            if(fileType === 'image') {
                setUploadType('image');
            } else if (fileType === 'video') {
                setUploadType('video');
            } else {
                toast({ variant: 'destructive', title: 'Unsupported File', description: 'Please select an image or video file.'});
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file || !user || !uploadType) {
            toast({
                variant: "destructive",
                title: "No File Selected",
                description: "Please select a file to upload.",
            });
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
                    const mediaUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

                    if (uploadType === 'video') {
                        // Logic to upload a video post
                        const videosCollection = collection(db, 'videos');
                        await addDoc(videosCollection, {
                            userId: user.uid,
                            videoUrl: mediaUrl,
                            description: description,
                            createdAt: serverTimestamp(),
                            likes: [],
                        });
                        toast({ title: "Video Uploaded!", description: "Your video is now on the For You page." });
                        router.push("/foryou");

                    } else { // 'image' for stories
                        const storiesCollection = collection(db, 'stories');
                        const now = Timestamp.now();
                        const expiresAt = new Timestamp(now.seconds + 24 * 60 * 60, now.nanoseconds);

                        await addDoc(storiesCollection, {
                            userId: user.uid,
                            mediaUrl: mediaUrl,
                            mediaType: 'image',
                            createdAt: serverTimestamp(),
                            expiresAt: expiresAt,
                        });
                        toast({ title: "Story Uploaded!", description: "Your new story is now live." });
                        router.push("/chat");
                    }

                } catch (error) {
                    console.error('Upload error:', error);
                    toast({ variant: 'destructive', title: 'Upload Error', description: 'Failed to upload your file.' });
                } finally {
                    setUploading(false);
                }
            };
        } catch (error) {
            console.error('File processing error:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while processing the file.'});
            setUploading(false);
        }
    };

    if (loadingUser) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Create a New Post</CardTitle>
                    <CardDescription>
                        Upload an image for your story or a video for the feed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div
                        className="w-full aspect-[9/16] bg-muted rounded-md flex items-center justify-center border-2 border-dashed cursor-pointer relative"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {preview ? (
                            <>
                                {uploadType === 'image' && <Image src={preview} alt="Preview" layout="fill" objectFit="cover" className="rounded-md" />}
                                {uploadType === 'video' && <video src={preview} muted loop autoPlay className="w-full h-full object-cover rounded-md" />}
                            </>
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <ImageIcon className="mx-auto h-12 w-12" />
                                <p className="mt-2">Click to select an image or video</p>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*,video/*"
                        />
                    </div>
                    {uploadType === 'video' && (
                        <Textarea 
                            placeholder="Add a description for your video..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="resize-none"
                        />
                    )}
                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full"
                        onClick={handleUpload}
                        disabled={!file || uploading}
                    >
                        {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        {uploading ? "Uploading..." : `Post ${uploadType === 'video' ? 'Video' : 'Story'}`}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
