# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Firestore Index for Stories

To enable the "Stories" feature, you need to create a composite index in your Firestore database. This is required for the query that fetches active stories from multiple users.

Please click the following link to create the required index in the Firebase console:

[https://console.firebase.google.com/v1/r/project/jtt-drive-lite/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9qdHQtZHJpdmUtbGl0ZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvc3Rvcmllcy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCglleHBpcmVzQXQQARoMCghfX25hbWVfXxAB](https://console.firebase.google.com/v1/r/project/jtt-drive-lite/firestore/indexes?create_composite=Ck5wcm9qZWN0cy9qdHQtZHJpdmUtbGl0ZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvc3Rvcmllcy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCglleHBpcmVzQXQQARoMCghfX25hbWVfXxAB)

After the index is created (which may take a few minutes), the stories feature will work correctly.
