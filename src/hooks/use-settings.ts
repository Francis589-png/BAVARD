
"use client";

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';

interface UserSettings {
    readReceipts: boolean;
    // Add other settings here in the future
}

const defaultSettings: UserSettings = {
    readReceipts: true,
};

export function useSettings(userId: string | null | undefined) {
    const [settings, setSettings] = useState<UserSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const settingsRef = doc(db, 'users', userId, 'preferences', 'settings');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setSettings({ ...defaultSettings, ...docSnap.data() } as UserSettings);
            } else {
                // If no settings doc, initialize with defaults
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
        if (!userId) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to change settings.' });
            return;
        }

        const settingsRef = doc(db, 'users', userId, 'preferences', 'settings');
        try {
            await setDoc(settingsRef, newSettings, { merge: true });
            toast({ title: 'Settings Updated', description: 'Your preferences have been saved.' });
        } catch (error) {
            console.error("Error updating settings: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your settings.' });
        }
    }, [userId, toast]);

    return { settings, loading, updateSettings };
}
