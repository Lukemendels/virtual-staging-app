import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;

console.log("[Firebase Admin] Loading firebase-admin.ts...");

const defaultApp = getApps().find(app => app.name === "[DEFAULT]");

if (!defaultApp) {
    console.log("[Firebase Admin] No default app found. Initializing...");
    if (serviceAccountKey) {
        console.log(`[Firebase Admin] Found SERVICE_ACCOUNT_KEY (Length: ${serviceAccountKey.length})`);
        try {
            let jsonString = serviceAccountKey;
            if (!jsonString.trim().startsWith("{")) {
                console.log("[Firebase Admin] Key does not start with '{', attempting Base64 decode...");
                jsonString = Buffer.from(jsonString, "base64").toString("utf-8");
                console.log(`[Firebase Admin] Base64 decode complete. First char: ${jsonString.trim().charAt(0)}`);
            } else {
                console.log("[Firebase Admin] Key starts with '{', assuming JSON string.");
            }

            const serviceAccount = JSON.parse(jsonString);
            console.log(`[Firebase Admin] Parsed service account. Project ID: ${serviceAccount.project_id}`);

            initializeApp({
                credential: cert(serviceAccount),
            });
            console.log("[Firebase Admin] initializeApp() called successfully.");
        } catch (error) {
            console.error("[Firebase Admin] Failed to parse SERVICE_ACCOUNT_KEY:", error);
        }
    } else {
        console.warn("[Firebase Admin] SERVICE_ACCOUNT_KEY is not defined. Firebase Admin not initialized.");
    }
} else {
    console.log(`[Firebase Admin] Default app already exists.`);
}

// Export db safely. If initialization failed, this might be an empty object or throw at runtime when used,
// which is preferable to crashing the build.
export const db = getApps().find(app => app.name === "[DEFAULT]") ? getFirestore() : ({} as FirebaseFirestore.Firestore);
