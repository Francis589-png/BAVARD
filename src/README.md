# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Required Firestore Indexes

To enable all features in this application, you must create a composite index in your Firestore database. This is required for querying unread message counts efficiently.

Please click the following link to create the required index in the Firebase console. The creation process may take a few minutes.

[https://console.firebase.google.com/v1/r/project/jtt-drive-lite/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9qdHQtZHJpdmUtbGl0ZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbWVzc2FnZXMvaW5kZXhlcy9fEAEaDAoIc2VuZGVySWQQARoNCgl0aW1lc3RhbXAQARoMCghfX25hbWVfXxAB](https://console.firebase.google.com/v1/r/project/jtt-drive-lite/firestore/indexes?create_composite=Ck9wcm9qZWN0cy9qdHQtZHJpdmUtbGl0ZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvbWVzc2FnZXMvaW5kZXhlcy9fEAEaDAoIc2VuZGVySWQQARoNCgl0aW1lc3RhbXAQARoMCghfX25hbWVfXxAB)

After the index is created, the unread message count feature will work correctly.
