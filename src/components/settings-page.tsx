
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Mic, Eye, Palette, CheckCircle, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/use-settings";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";


export default function SettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { settings, updateSettings, loading: settingsLoading } = useSettings(user?.uid);
    const { theme, setTheme } = useTheme();
    const { toast } = useToast();

    const [micStatus, setMicStatus] = useState<PermissionState | "prompt" | "unsupported">("prompt");

    useEffect(() => {
        if (!settingsLoading) {
            if (navigator.permissions && navigator.permissions.query) {
                navigator.permissions.query({ name: 'microphone' as PermissionName }).then((permissionStatus) => {
                    setMicStatus(permissionStatus.state);
                    permissionStatus.onchange = () => {
                        setMicStatus(permissionStatus.state);
                    };
                });
            } else {
                setMicStatus("unsupported");
            }
        }
    }, [settingsLoading]);

    const handleRequestMicPermission = async () => {
        if (micStatus === "unsupported") {
            toast({ variant: "destructive", title: "Unsupported", description: "Your browser does not support microphone permissions." });
            return;
        }
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error) {
            console.error("Mic permission error", error);
            // State update will happen via the onchange listener
        }
    };


    if (authLoading || settingsLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="min-h-screen bg-secondary">
            <header className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background p-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/chat')}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-xl font-bold">Settings</h1>
            </header>

            <main className="p-4 md:p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Permissions</CardTitle>
                            <CardDescription>Manage application permissions for a better experience.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="mic-permission" className="text-base flex items-center gap-2">
                                        <Mic className="w-5 h-5"/>
                                        Microphone Access
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Required for sending voice messages.
                                    </p>
                                </div>
                                 <div className="flex items-center gap-2">
                                     {micStatus === 'granted' && <span className="text-sm flex items-center gap-1 text-green-600"><CheckCircle className="w-4 h-4"/> Allowed</span>}
                                     {micStatus === 'denied' && <span className="text-sm flex items-center gap-1 text-destructive"><AlertCircle className="w-4 h-4"/> Denied</span>}
                                     {micStatus === 'prompt' && (
                                         <Button size="sm" onClick={handleRequestMicPermission}>
                                             Request Access
                                         </Button>
                                     )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Privacy</CardTitle>
                            <CardDescription>Control how your activity is shared with others.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="read-receipts" className="text-base flex items-center gap-2">
                                        <Eye className="w-5 h-5"/>
                                        Read Receipts
                                    </Label>
                                     <p className="text-sm text-muted-foreground">
                                        Let others know when you have read their messages.
                                    </p>
                                </div>
                                <Switch
                                    id="read-receipts"
                                    checked={settings.readReceipts}
                                    onCheckedChange={(checked) => updateSettings({ readReceipts: checked })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Customize the look and feel of the application.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="theme-select" className="text-base flex items-center gap-2">
                                        <Palette className="w-5 h-5"/>
                                        Theme
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                       Select a theme for the application interface.
                                    </p>
                                </div>
                                <Select value={theme} onValueChange={setTheme}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Select theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light</SelectItem>
                                        <SelectItem value="dark">Dark</SelectItem>
                                        <SelectItem value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
