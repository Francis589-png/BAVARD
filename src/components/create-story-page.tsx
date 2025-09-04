
"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";

export default function CreateStoryPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
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

    const handleUploadStory = async () => {
        if (!imageFile || !user) {
            toast({
                variant: "destructive",
                title: "No Image Selected",
                description: "Please select an image to upload for your story.",
            });
            return;
        }

        setUploading(true);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = async () => {
                const dataUri = reader.result as string;
                try {
                    const ipfsHash = await uploadFile({ dataUri, fileName: imageFile.name });
                    const storiesCollection = collection(db, 'stories');
                    const now = Timestamp.now();
                    const expiresAt = new Timestamp(now.seconds + 24 * 60 * 60, now.nanoseconds);

                    await addDoc(storiesCollection, {
                        userId: user.uid,
                        mediaUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                        mediaType: 'image',
                        createdAt: serverTimestamp(),
                        expiresAt: expiresAt,
                    });

                    toast({
                        title: "Story Uploaded!",
                        description: "Your new story is now live for your contacts to see.",
                    });
                    router.push("/chat");

                } catch (error) {
                    console.error('Story upload error:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Upload Error',
                        description: 'Failed to upload your story.',
                    });
                } finally {
                    setUploading(false);
                }
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

    if (loadingUser) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 left-4"
                onClick={() => router.back()}
            >
                <ArrowLeft />
            </Button>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Create a New Story</CardTitle>
                    <CardDescription>
                        Upload an image to share with your contacts for the next 24 hours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        className="w-full aspect-[9/16] bg-muted rounded-md flex items-center justify-center border-2 border-dashed cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {imagePreview ? (
                            <Image src={imagePreview} alt="Story preview" layout="fill" objectFit="cover" className="rounded-md" />
                        ) : (
                            <div className="text-center text-muted-foreground">
                                <ImageIcon className="mx-auto h-12 w-12" />
                                <p>Click to select an image</p>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full"
                        onClick={handleUploadStory}
                        disabled={!imageFile || uploading}
                    >
                        {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        {uploading ? "Uploading..." : "Post Story"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
