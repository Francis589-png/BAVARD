
'use server';

import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

// !!! IMPORTANT SECURITY !!!
// To grant admin access, replace this placeholder with your actual Firebase User ID (UID).
// You can find your UID in the Firebase console under Authentication.
const ADMIN_UIDS = [
    'moxVcsIoAggsIf1tKpfXIMFX9nN2'
];

/**
 * Checks if a user is an admin.
 * @param userId The ID of the user to check.
 * @returns A promise that resolves to true if the user is an admin, false otherwise.
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) {
        return false;
    }
    return ADMIN_UIDS.includes(userId);
}


/**
 * Fetches application-wide statistics.
 * This function should only be callable by admins.
 * @returns An object containing total users, posts, and storage used.
 */
export async function getAppStatistics(): Promise<{
    totalUsers: number;
    totalPosts: number;
    totalStorageBytes: number;
}> {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const postsSnapshot = await getDocs(collection(db, "posts"));
    
    let totalStorageBytes = 0;
    
    const userFilesPromises = usersSnapshot.docs.map(userDoc => 
        getDocs(collection(db, "users", userDoc.id, "files"))
    );
    const userFilesSnapshots = await Promise.all(userFilesPromises);

    userFilesSnapshots.forEach(filesSnapshot => {
        filesSnapshot.forEach(fileDoc => {
            totalStorageBytes += fileDoc.data().size || 0;
        });
    });

    return {
        totalUsers: usersSnapshot.size,
        totalPosts: postsSnapshot.size,
        totalStorageBytes,
    };
}

/**
 * Fetches all users from the database.
 * This function should only be callable by admins.
 * @returns An array of all user objects.
 */
export async function getAllUsers(): Promise<any[]> {
    const usersSnapshot = await getDocs(collection(db, "users"));
    return usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}


/**
 * Updates a user's status (ban, verify, etc.).
 * This function is protected and can only be called by an admin.
 * @param adminId The UID of the user making the request.
 * @param targetUserId The UID of the user to update.
 * @param updates An object containing the fields to update (e.g., { isBanned: true }).
 */
export async function updateUserStatus(
    adminId: string,
    targetUserId: string,
    updates: { isBanned?: boolean; isVerified?: boolean }
): Promise<void> {
    const isUserAdmin = await isAdmin(adminId);
    if (!isUserAdmin) {
        throw new Error("Permission denied: You must be an admin to perform this action.");
    }
    
    if (!targetUserId) {
        throw new Error("Target user ID is required.");
    }

    const userRef = doc(db, "users", targetUserId);
    await updateDoc(userRef, updates);
}
