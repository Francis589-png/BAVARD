
"use client";

import { useState, useRef, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Upload, CheckCircle, AlertCircle, FileCheck2, UserCheck, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadFile } from "@/ai/flows/pinata-flow";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


interface ProfileData {
    avatar?: string;
    description?: string;
}

export default function ApplyForVerificationPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [idPhoto, setIdPhoto] = useState<File | null>(null);
    const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
    const idPhotoInputRef = useRef<HTMLInputElement>(null);

    const [selfie, setSelfie] = useState<File | null>(null);
    const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
    const selfieInputRef = useRef<HTMLInputElement>(null);
    
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [existingRequest, setExistingRequest] = useState(false);

    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                
                // Check for existing request
                const requestRef = doc(db, 'verificationRequests', user.uid);
                const requestSnap = await getDoc(requestRef);
                if (requestSnap.exists()) {
                    setExistingRequest(true);
                }

                // Check profile completion
                const profileRef = doc(db, 'users', user.uid);
                const profileSnap = await getDoc(profileRef);
                if (profileSnap.exists()) {
                    const data = profileSnap.data();
                    setProfileData({
                        avatar: data.avatar,
                        description: data.description,
                    });
                }

            } else {
                router.push("/login");
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'selfie') => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'id') {
                    setIdPhoto(file);
                    setIdPhotoPreview(reader.result as string);
                } else {
                    setSelfie(file);
                    setSelfiePreview(reader.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = async () => {
        if (!idPhoto || !selfie || !user) {
            toast({ variant: 'destructive', title: 'Missing Files', description: 'Please upload both required images.'});
            return;
        }

        setUploading(true);

        try {
            // Upload ID photo
            const idReader = new FileReader();
            idReader.readAsDataURL(idPhoto);
            const idDataUri = await new Promise<string>((resolve) => { idReader.onload = () => resolve(idReader.result as string) });
            const idIpfsHash = await uploadFile({ dataUri: idDataUri, fileName: `id-${user.uid}-${idPhoto.name}`});
            const idUrl = `https://gateway.pinata.cloud/ipfs/${idIpfsHash}`;

            // Upload Selfie photo
            const selfieReader = new FileReader();
            selfieReader.readAsDataURL(selfie);
            const selfieDataUri = await new Promise<string>((resolve) => { selfieReader.onload = () => resolve(selfieReader.result as string) });
            const selfieIpfsHash = await uploadFile({ dataUri: selfieDataUri, fileName: `selfie-${user.uid}-${selfie.name}`});
            const selfieUrl = `https://gateway.pinata.cloud/ipfs/${selfieIpfsHash}`;

            // Create Firestore document
            const requestRef = doc(db, 'verificationRequests', user.uid);
            await setDoc(requestRef, {
                userId: user.uid,
                idPhotoUrl: idUrl,
                selfieUrl: selfieUrl,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            toast({ title: "Application Submitted!", description: "Your verification request has been sent for review."});
            setExistingRequest(true);

        } catch (error) {
            console.error("Verification submission error:", error);
            toast({ variant: 'destructive', title: 'Submission Error', description: 'Could not submit your application. Please try again.' });
        } finally {
            setUploading(false);
        }
    }
    
    const prerequisitesMet = profileData?.avatar && profileData?.description;

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (existingRequest) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
                 <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2">
                           <FileCheck2 className="h-7 w-7 text-green-500" />
                           Application Submitted
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Your verification request is currently under review by our team. We will notify you once a decision has been made.</p>
                    </CardContent>
                     <CardFooter>
                        <Button className="w-full" onClick={() => router.push('/profile')}>Go to My Profile</Button>
                    </CardFooter>
                </Card>
             </div>
        );
    }
    
    if (!prerequisitesMet) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
                <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2">
                           <AlertCircle className="h-7 w-7 text-yellow-500" />
                           Profile Incomplete
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">To apply for verification, you must first complete your profile.</p>
                        <div className="space-y-2 text-left">
                            <div className="flex items-center gap-2">
                                {profileData?.avatar ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                                <span>Have a profile picture</span>
                            </div>
                             <div className="flex items-center gap-2">
                                {profileData?.description ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                                <span>Have a bio/description</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Link href="/profile" className="w-full">
                           <Button className="w-full">Complete Profile</Button>
                        </Link>
                    </CardFooter>
                </Card>
             </div>
        );
    }


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
             <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Apply for Verification
                    </CardTitle>
                    <CardDescription>
                        Submit the required documents to get a verification badge on your profile.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="font-semibold">1. ID Document</h3>
                        <p className="text-sm text-muted-foreground">Upload a clear photo of your Passport or official ID card.</p>
                        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed cursor-pointer relative" onClick={() => idPhotoInputRef.current?.click()}>
                           {idPhotoPreview ? (
                                <Image src={idPhotoPreview} alt="ID Preview" layout="fill" objectFit="contain" className="rounded-md p-2" />
                           ) : (
                               <div className="text-center text-muted-foreground p-4">
                                   <Upload className="mx-auto h-10 w-10" />
                                   <p className="mt-2 text-xs">Click to upload ID photo</p>
                               </div>
                           )}
                           <input type="file" ref={idPhotoInputRef} onChange={(e) => handleFileChange(e, 'id')} className="hidden" accept="image/*" />
                        </div>
                    </div>
                     <div className="space-y-2">
                        <h3 className="font-semibold">2. Selfie with ID</h3>
                        <p className="text-sm text-muted-foreground">Upload a photo of yourself holding the ID document you uploaded above. Make sure your face and the ID are clearly visible.</p>
                        <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed cursor-pointer relative" onClick={() => selfieInputRef.current?.click()}>
                           {selfiePreview ? (
                                <Image src={selfiePreview} alt="Selfie Preview" layout="fill" objectFit="contain" className="rounded-md p-2" />
                           ) : (
                               <div className="text-center text-muted-foreground p-4">
                                   <UserCheck className="mx-auto h-10 w-10" />
                                   <p className="mt-2 text-xs">Click to upload selfie</p>
                               </div>
                           )}
                           <input type="file" ref={selfieInputRef} onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" accept="image/*" />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                     <Button className="w-full" onClick={handleSubmit} disabled={!idPhoto || !selfie || uploading}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {uploading ? 'Submitting...' : 'Submit for Review'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
