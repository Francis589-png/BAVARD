

'use server';

import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, serverTimestamp, setDoc, deleteDoc, Timestamp } from "firebase/firestore";

// !!! IMPORTANT SECURITY !!!
// To grant admin access, replace this placeholder with your actual Firebase User ID (UID).
// You can find your UID in the Firebase console under Authentication.
const ADMIN_UIDS = [
    'moxVcsIoAggsIf1tKpfXIMFX9nN2'
];

// This is a special, reserved UID for the "BAVARD" system user.
// All official communications will come from this user.
// In a real application, this user would be created in Firebase Auth and its UID used here.
const BAVARD_SYSTEM_UID = 'bavard_system_user';


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
    return usersSnapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure createdAt is serializable
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            data.createdAt = data.createdAt.toDate().toISOString();
        }
        return {
            id: doc.id,
            ...data
        }
    });
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

/**
 * Sends an official message from "BAVARD" to a user.
 * This function is protected and can only be called by an admin.
 * @param adminId The UID of the admin sending the message.
 * @param targetUserId The UID of the user to message.
 * @param message The text of the message to send.
 */
export async function sendBavardMessage(adminId: string, targetUserId: string, message: string): Promise<void> {
    const isUserAdmin = await isAdmin(adminId);
    if (!isUserAdmin) {
        throw new Error("Permission denied: You must be an admin to perform this action.");
    }

    // 1. Ensure the "BAVARD" user exists in the target user's contacts
    const bavardContactRef = doc(db, 'users', targetUserId, 'contacts', BAVARD_SYSTEM_UID);
    const bavardContactSnap = await getDoc(bavardContactRef);
    if (!bavardContactSnap.exists()) {
        // We add a "user" document for Bavard as well, so it can be resolved in the chat UI
        const bavardUserRef = doc(db, 'users', BAVARD_SYSTEM_UID);
        await setDoc(bavardUserRef, {
            name: "BAVARD",
            email: "official@bavard.app",
            avatar: "", // Or a branded avatar URL
            isVerified: true,
        }, { merge: true });

        await setDoc(bavardContactRef, { addedAt: serverTimestamp() });
    }

    // 2. Add the message to the chat
    const chatId = [targetUserId, BAVARD_SYSTEM_UID].sort().join('_');
    const messagesCollection = collection(db, 'chats', chatId, 'messages');
    
    await addDoc(messagesCollection, {
        senderId: BAVARD_SYSTEM_UID,
        text: message,
        timestamp: serverTimestamp(),
        type: 'text',
    });
}


/**
 * Fetches all reports from the database.
 * This function should only be callable by admins.
 * @returns An array of all report objects, enriched with post and user details.
 */
export async function getReports(): Promise<any[]> {
    const reportsSnapshot = await getDocs(collection(db, 'reports'));
    const reports = reportsSnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            data.createdAt = data.createdAt.toDate().toISOString();
        }
        return { id: doc.id, ...data };
    });

    const populatedReports = await Promise.all(reports.map(async (report) => {
        const postDoc = await getDoc(doc(db, 'posts', report.postId));
        const reportedByUserDoc = await getDoc(doc(db, 'users', report.reportedBy));
        
        let postAuthorDoc: any = null;
        if (postDoc.exists()) {
            postAuthorDoc = await getDoc(doc(db, 'users', postDoc.data()!.userId));
        }

        return {
            ...report,
            post: postDoc.exists() ? { id: postDoc.id, ...postDoc.data() } : null,
            reportedBy_User: reportedByUserDoc.exists() ? { id: reportedByUserDoc.id, ...reportedByUserDoc.data() } : null,
            postAuthor: postAuthorDoc && postAuthorDoc.exists() ? { id: postAuthorDoc.id, ...postAuthorDoc.data() } : null,
        };
    }));

    return populatedReports;
}


/**
 * Fetches all pending verification requests from the database.
 * @returns An array of request objects, enriched with user details.
 */
export async function getVerificationRequests(): Promise<any[]> {
    const requestsSnapshot = await getDocs(collection(db, 'verificationRequests'));
    const requests = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
            data.createdAt = data.createdAt.toDate().toISOString();
        }
        return { id: doc.id, ...data };
    });

    const populatedRequests = await Promise.all(requests.map(async (request) => {
        const userDoc = await getDoc(doc(db, 'users', request.userId));
        return {
            ...request,
            user: userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null,
        };
    }));
    
    // Filter out any requests where the user might have been deleted
    return populatedRequests.filter(req => req.user);
}

/**
 * Processes a verification request by approving or rejecting it.
 * @param adminId The UID of the admin performing the action.
 * @param targetUserId The UID of the user whose request is being processed.
 * @param action The action to perform: 'approve' or 'reject'.
 */
export async function processVerificationRequest(adminId: string, targetUserId: string, action: 'approve' | 'reject'): Promise<void> {
    const isUserAdmin = await isAdmin(adminId);
    if (!isUserAdmin) {
        throw new Error("Permission denied: You must be an admin to perform this action.");
    }
    
    const requestRef = doc(db, 'verificationRequests', targetUserId);
    
    if (action === 'approve') {
        const userRef = doc(db, 'users', targetUserId);
        await updateDoc(userRef, { isVerified: true });
    }
    
    // For both approve and reject, we delete the request
    await deleteDoc(requestRef);
}
