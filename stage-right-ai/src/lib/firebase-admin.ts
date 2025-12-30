import { initializeApp, getApps, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function initFirebaseAdmin() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    console.log("[Firebase Admin] No default app found. Initializing...");
    const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;

    if (serviceAccountKey) {
        try {
            let jsonString = serviceAccountKey;
            if (!jsonString.trim().startsWith("{")) {
                jsonString = Buffer.from(jsonString, "base64").toString("utf-8");
            }
            const serviceAccount = JSON.parse(jsonString);
            const app = initializeApp({
                credential: cert(serviceAccount),
            });
            console.log("[Firebase Admin] initializeApp() called successfully.");
            return app;
        } catch (error) {
            console.error("[Firebase Admin] Failed to parse SERVICE_ACCOUNT_KEY:", error);
        }
    } else {
        console.warn("[Firebase Admin] SERVICE_ACCOUNT_KEY is not defined. Firebase Admin not initialized.");
    }
    return undefined;
}

// Initialize on import
initFirebaseAdmin();

// Export db safely. If initialization failed, this might be an empty object or throw at runtime when used,
// which is preferable to crashing the build.
export const db = getApps().find(app => app.name === "[DEFAULT]") ? getFirestore() : ({} as FirebaseFirestore.Firestore);
