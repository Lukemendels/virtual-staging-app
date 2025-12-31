
import { NextResponse } from "next/server";
import { App } from "firebase-admin/app";
import { initFirebaseAdmin } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { callVertexWithRetry } from "@/lib/vertex-utils";
import { REFINE_SYSTEM_PROMPT } from "@/lib/prompt-engine";

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
    // Variable Declarations for Safety Net
    let userId: string | undefined;
    let projectId: string | undefined;
    let deductEdit: boolean = false;

    try {
        const app = initFirebaseAdmin();
        if (!app) throw new Error("Firebase Admin failed to initialize");

        // 1. Authenticate User
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split("Bearer ")[1];
        const decodedToken = await getAuth(app).verifyIdToken(idToken);
        userId = decodedToken.uid;

        const body = await request.json();
        const { image, mask, prompt, roomType, style, projectId: reqProjectId } = body;
        projectId = reqProjectId;

        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }

        // 2. Deduction Logic (1 Edit Point)
        deductEdit = true;

        if (deductEdit && projectId) {
            const dbInstance = getFirestore(app);
            await dbInstance.runTransaction(async (transaction) => {
                if (!userId) throw new Error("User ID missing");

                const projectRef = dbInstance.collection("projects").doc(projectId!);
                const projectDoc = await transaction.get(projectRef);

                if (!projectDoc.exists) throw new Error("Project not found");
                if (projectDoc.data()?.userId !== userId) throw new Error("Unauthorized");

                const currentEdits = projectDoc.data()?.edits_remaining || 0;
                if (currentEdits <= 0) throw new Error("No edits remaining");

                transaction.update(projectRef, { edits_remaining: currentEdits - 1 });
            });
        }

        // 3. AI Pipeline (Gemini 2.0 Flash Exp)
        const gcpProjectId = getProjectId();
        const accessToken = await getAccessToken(app);

        // Optimize prompt for 2.0 Flash
        const editPrompt = `
        TASK: Edit this image based on the user request: "${prompt}".
        CONTEXT: Room Type: ${roomType}, Style: ${style}.
        INSTRUCTION: If a red mask is provided, ONLY edit the pixels covered by the red mask. 
        Remove the red mask in the final output and replace it with realistic furniture or materials matching the request.
        Keep lighting consistent.
        `;

        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`;

        const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
        // If mask is provided, we *could* pass it as a separate image part or as "visual prompting" (red lines on main image).
        // Since we are restoring the "AnnotationCanvas", the frontend will likely burn the red lines onto the 'image' itself.
        // So we just need to pass the single image with red lines.

        console.log("[Edit API] Calling Gemini 2.0 Flash Exp...");

        const generationData = await callVertexWithRetry<any>(() => fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: REFINE_SYSTEM_PROMPT }, // System instruction as text part
                        { text: editPrompt },
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

        return NextResponse.json({
            result: `data:image/jpeg;base64,${generatedImageBase64}`,
            projectId: projectId,
            editsRemaining: "decremented" // Frontend handles decrement, or we could return actual number
        });

    } catch (error: any) {
        console.error("Edit API Error:", error);

        // --- SAFETY NET: REFUND EDIT ---
        const app = initFirebaseAdmin();
        if (app && userId && projectId && deductEdit) {
            try {
                const dbInstance = getFirestore(app);
                await dbInstance.runTransaction(async (transaction) => {
                    // Check IDs again for safety
                    if (!userId || !projectId) return;

                    const projectRef = dbInstance.collection("projects").doc(projectId);
                    const pDoc = await transaction.get(projectRef);
                    if (pDoc.exists) {
                        const current = pDoc.data()?.edits_remaining || 0;
                        transaction.update(projectRef, { edits_remaining: current + 1 });
                        console.log(`[Safety Net] Refunded 1 edit to project ${projectId}`);
                    }
                });
            } catch (refundError) {
                console.error("[Safety Net] Refund Failed!", refundError);
            }
        }
        // --------------------------------

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
