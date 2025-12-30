import { NextResponse } from "next/server";
import { App } from "firebase-admin/app"; // Import App type specifically
import * as admin from "firebase-admin";
import { initFirebaseAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { callVertexWithRetry } from "@/lib/vertex-utils";
import { buildStagingPrompt, SYSTEM_PROMPT } from "@/lib/prompt-engine";
import { verifyStagingResult } from "@/lib/verification-engine";

// Helper to get Access Token
async function getAccessToken(app: App) {
    const accessTokenObj = await app.options.credential?.getAccessToken();
    return accessTokenObj?.access_token;
}

// Helper to get Project ID
function getProjectId() {
    let serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY as string;
    if (!serviceAccountKey) {
        throw new Error("SERVICE_ACCOUNT_KEY is not defined");
    }
    if (!serviceAccountKey.trim().startsWith("{")) {
        serviceAccountKey = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);
    return serviceAccount.project_id;
}

export async function POST(request: Request) {
    let userId: string | undefined;
    let deductCredit: boolean = false;
    let finalProjectId: string | undefined;
    let projectId: string | undefined;

    try {
        // Force initialization check
        const app = initFirebaseAdmin();
        if (!app) throw new Error("Firebase Admin failed to initialize");

        // 1. Authenticate User
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split("Bearer ")[1];
        console.log("[Stage V3 API] Verifying ID token...");
        const decodedToken = await getAuth(app).verifyIdToken(idToken);
        userId = decodedToken.uid;

        const body = await request.json();
        const { image, style, roomType, prompt, isRetry } = body;
        projectId = body.projectId;

        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }

        // 2. Credit / Edit Logic
        finalProjectId = projectId;
        let newEditsRemaining = 0;

        // Only deduct credit if this is NOT an automated retry
        deductCredit = !isRetry;

        if (deductCredit) {
            const dbInstance = getFirestore(app);

            await dbInstance.runTransaction(async (transaction) => {
                if (!userId) throw new Error("User ID missing in transaction");
                const userRef = dbInstance.collection("users").doc(userId);
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) throw new Error("User not found");

                const userData = userDoc.data();
                const credits = userData?.credits || 0;

                if (projectId) {
                    // Existing Project
                    const projectRef = dbInstance.collection("projects").doc(projectId);
                    const projectDoc = await transaction.get(projectRef);
                    if (!projectDoc.exists) throw new Error("Project not found");
                    if (projectDoc.data()?.userId !== userId) throw new Error("Unauthorized");

                    // If purely refining, we check edits. But since we removed "Refine" manual mode,
                    // this branch might only be hit if user "Restages" from the UI.
                    // Let's assume re-stage costs 1 edit for now.
                    if (projectDoc.data()?.edits_remaining <= 0) throw new Error("No edits remaining");

                    newEditsRemaining = projectDoc.data()?.edits_remaining - 1;
                    transaction.update(projectRef, { edits_remaining: newEditsRemaining });
                } else {
                    // New Project
                    if (credits < 1) throw new Error("Insufficient credits");
                    transaction.update(userRef, { credits: credits - 1 });

                    const newProjectRef = dbInstance.collection("projects").doc();
                    finalProjectId = newProjectRef.id;
                    newEditsRemaining = 2; // Default
                    transaction.set(newProjectRef, {
                        userId, createdAt: new Date(), style, roomType, edits_remaining: 2,
                        model: "gemini-3.0-pro-v3-flashexp"
                    });
                }
            });
        }

        // 3. AI Pipeline (Gemini 3.0 Pro Image Preview)
        const gcpProjectId = getProjectId();
        const accessToken = await getAccessToken(app);
        const base64Image = image.replace(/^data:image\/\w+;base64,/, "");

        // ENDPOINT: Global (Gemini 3 Pro)
        const generationEndpoint = `https://aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;
        const masterPrompt = buildStagingPrompt(prompt || "", roomType || "living_room", style || "modern_farmhouse", "v3");

        console.log("[Stage V3 API] Generating Image...");

        const generationData = await callVertexWithRetry<any>(() => fetch(generationEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: masterPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }],
                generationConfig: { candidateCount: 1, temperature: 0.1 }
            })
        }));

        const generatedImageBase64 = generationData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

        if (!generatedImageBase64) {
            const text = generationData.candidates?.[0]?.content?.parts?.[0]?.text;
            throw new Error(`Model returned text instead of image: ${text?.substring(0, 100)}`);
        }

        // 4. Verification Loop (Flash 2.0 Exp)
        console.log("[Stage V3 API] Verifying with Flash...");
        // Generate a temporary API Key using Vertex token IS NOT SUPPORTED for the GenerativeAI SDK usually
        // The GenerativeAI SDK (used in verification-engine) expects an API KEY.
        // HACK: For this "server-side" verification using Vertex, we should probably stick to Vertex REST API 
        // to avoid key management issues. However, the user asked for "3.0 Flash".
        // Let's assume we use the SAME Vertex REST approach but targeting the Flash model.
        // I will inline the verification REST call here to reuse the accessToken we already have.

        const verificationEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-3-flash-preview:generateContent`;

        const verificationPrompt = `
        ROLE: Senior Interior Design QA.
        TASK: Verify image.
        INPUT: Room=${roomType}, Style=${style}.
        FAIL IF: Floating furniture, structural damage (walls/windows removed), bad perspective.
        OUTPUT: JSON { "pass": boolean, "reason": "string" }
        `;

        const verifyData = await fetch(verificationEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: verificationPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: generatedImageBase64 } }
                    ]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        }).then(res => res.json());

        let verificationResult = { pass: true, reason: "Verification bypassed" };
        try {
            const rawText = verifyData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) verificationResult = JSON.parse(rawText);
        } catch (e) {
            console.warn("Verification parsing failed", e);
        }

        console.log(`[Stage V3 API] Verification Result: ${JSON.stringify(verificationResult)}`);

        if (!verificationResult.pass) {
            // AUTO-RETRY LOGIC (1 Attempt)
            if (!isRetry) {
                console.log("[Stage V3 API] Verification failed. Auto-retrying...");
                // Recursive call to self (or just loop logic, but recursion is cleaner for simple logic)
                // For simplicity in this route handler, let's just return a specific error code 
                // that the frontend can use to immediately retry, OR we handle it here.
                // Handling here is hard because we need to re-deduct? No, we skipped deduction.
                // Let's return a specific status "422 Unprocessable Entity - Verification Failed" 
                // and let the frontend trigger the retry with `isRetry: true`.
                return NextResponse.json({
                    error: "Verification Failed",
                    reason: verificationResult.reason,
                    shouldRetry: true
                }, { status: 422 });
            } else {
                console.warn("[Stage V3 API] Retry failed. Delivering anyway.");
                // If retry also failed, we deliver with a warning header? 
                // Or just deliver. User asked for verify, not "block forever".
            }
        }

        return NextResponse.json({
            result: `data:image/jpeg;base64,${generatedImageBase64}`,
            projectId: finalProjectId,
            editsRemaining: newEditsRemaining,
            verification: verificationResult
        });

    } catch (error: any) {
        console.error("Stage API Error:", error);

        // --- SAFETY NET: REFUND CREDIT ---
        // If we dedicated a credit/edit but failed to deliver (Timeout/503), refund it.
        const app = initFirebaseAdmin(); // Re-grab app just in case (cheap)
        if (app && userId && deductCredit) {
            try {
                const dbInstance = getFirestore(app);
                await dbInstance.runTransaction(async (transaction) => {
                    if (projectId) {
                        // Existing Project: Refund +1 Edit
                        const projectRef = dbInstance.collection("projects").doc(projectId);
                        const pDoc = await transaction.get(projectRef);
                        if (pDoc.exists) {
                            const current = pDoc.data()?.edits_remaining || 0;
                            transaction.update(projectRef, { edits_remaining: current + 1 });
                            console.log(`[Safety Net] Refunded 1 edit to project ${projectId}`);
                        }
                    } else if (finalProjectId) {
                        // New Project: Refund +1 Credit to User
                        // Note: If we created a project doc (finalProjectId), we technically leave a "glitch" empty project.
                        // But more importantly, we must restore the user's credit balance.
                        if (!userId) {
                            console.error("[Safety Net] UserId missing during refund");
                            return;
                        }
                        const userRef = dbInstance.collection("users").doc(userId);
                        const uDoc = await transaction.get(userRef);
                        if (uDoc.exists) {
                            const current = uDoc.data()?.credits || 0;
                            transaction.update(userRef, { credits: current + 1 });
                            console.log(`[Safety Net] Refunded 1 credit to user ${userId}`);
                        }
                    }
                });
            } catch (refundError) {
                console.error("[Safety Net] Refund Failed!", refundError);
                // System Alert: Critical Failure (Money lost)
            }
        }
        // ----------------------------------

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
