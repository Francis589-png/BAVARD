
"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, ArrowLeft, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { doc, updateDoc } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                router.push("/login");
            }
            setLoading(false);
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

    const handleUpdateProfilePicture = async () => {
        if (!imageFile || !user) {
            toast({
                variant: "destructive",
                title: "No Image Selected",
                description: "Please select an image to upload.",
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
                    const newAvatarUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

                    // Update Firebase Auth profile
                    await updateProfile(user, { photoURL: newAvatarUrl });

                    // Update Firestore user document
                    const userDocRef = doc(db, 'users', user.uid);
                    await updateDoc(userDocRef, { avatar: newAvatarUrl });

                    toast({
                        title: "Profile Updated!",
                        description: "Your new profile picture is now set.",
                    });
                    
                    // Force a reload of the user object to reflect changes
                    await user.reload();
                    setUser({ ...user }); // Trigger re-render
                    setImageFile(null);
                    setImagePreview(null);


                } catch (error) {
                    console.error('Profile update error:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Update Error',
                        description: 'Failed to update your profile picture.',
                    });
                } finally {
                    setUploading(false);
                }
            };
             reader.onerror = (error) => {
                setUploading(false);
                toast({ variant: 'destructive', title: 'File Error', description: 'Failed to read the selected file.' });
            }
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

    if (loading || !user) {
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
                onClick={() => router.push('/chat')}
            >
                <ArrowLeft />
            </Button>
            <Card className="w-full max-w-md">
                <CardHeader className="items-center text-center">
                    <div className="relative">
                        <Avatar className="w-32 h-32 text-4xl">
                            <AvatarImage src={imagePreview || user.photoURL || undefined} alt={user.displayName || user.email || 'User'} />
                            <AvatarFallback>{user.displayName?.charAt(0) || user.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <Button size="icon" className="absolute bottom-1 right-1 rounded-full" onClick={() => fileInputRef.current?.click()}>
                           <Camera className="w-5 h-5"/>
                           <span className="sr-only">Change picture</span>
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="image/*"
                        />
                    </div>

                    <CardTitle className="pt-4">{user.displayName || "Anonymous"}</CardTitle>
                    <CardDescription>
                        {user.email}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {imagePreview && (
                     <div className="p-4 border rounded-md">
                         <h3 className="font-medium mb-2 text-center">New Picture Preview</h3>
                         <Image src={imagePreview} alt="New profile preview" width={400} height={400} objectFit="cover" className="rounded-md aspect-square mx-auto" />
                     </div>
                   )}
                </CardContent>
                <CardFooter>
                    <Button
                        className="w-full"
                        onClick={handleUpdateProfilePicture}
                        disabled={!imageFile || uploading}
                    >
                        {uploading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        {uploading ? "Uploading..." : "Save Changes"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
