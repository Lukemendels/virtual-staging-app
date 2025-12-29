import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { callVertexWithRetry } from "@/lib/vertex-utils";
import { buildStagingPrompt, SYSTEM_PROMPT } from "@/lib/prompt-engine";

// Helper to get Access Token
async function getAccessToken() {
    const accessTokenObj = await admin.app().options.credential?.getAccessToken();
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
    try {
        // 1. Authenticate User
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split("Bearer ")[1];
        console.log("[Stage Pro API] Verifying ID token...");
        const decodedToken = await getAuth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const { image, style, roomType, projectId, prompt } = await request.json();

        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }

        // 2. Credit / Edit Logic (Transaction)
        let finalProjectId = projectId;
        let newEditsRemaining = 0;

        if (!db.runTransaction) {
            throw new Error("Database not initialized (check service account key)");
        }

        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error("User not found");
            }

            const userData = userDoc.data();
            const credits = userData?.credits || 0;

            if (projectId) {
                // Existing Project: Check edits_remaining
                const projectRef = db.collection("projects").doc(projectId);
                const projectDoc = await transaction.get(projectRef);

                if (!projectDoc.exists) {
                    throw new Error("Project not found");
                }

                const projectData = projectDoc.data();
                if (projectData?.userId !== userId) {
                    throw new Error("Unauthorized access to project");
                }

                if (projectData.edits_remaining <= 0) {
                    throw new Error("No edits remaining for this project");
                }

                newEditsRemaining = projectData.edits_remaining - 1;
                transaction.update(projectRef, { edits_remaining: newEditsRemaining });

            } else {
                // New Project: Deduct 1 Credit
                if (credits < 1) {
                    throw new Error("Insufficient credits");
                }

                transaction.update(userRef, { credits: credits - 1 });

                // Create new project document
                const newProjectRef = db.collection("projects").doc();
                finalProjectId = newProjectRef.id;
                newEditsRemaining = 2; // Default to 2 edits

                transaction.set(newProjectRef, {
                    userId,
                    createdAt: new Date(),
                    style,
                    roomType,
                    edits_remaining: 2,
                    originalImage: "stored_in_client_for_now_or_upload_to_storage_later",
                    model: "gemini-3.0-pro-image-preview" // Track model
                });
            }
        });

        // 3. AI Pipeline (Vertex AI REST API)
        const gcpProjectId = getProjectId();
        const accessToken = await getAccessToken();

        if (!accessToken) {
            throw new Error("Failed to generate Access Token");
        }

        const base64Image = image.replace(/^data:image\/\w+;base64,/, "");

        // PRO MODEL: gemini-3-pro-image-preview
        // ENDPOINT: Global
        // Format: https://aiplatform.googleapis.com/v1/projects/<project>/locations/global/publishers/google/models/<model>:generateContent

        const generationEndpoint = `https://aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/global/publishers/google/models/gemini-3-pro-image-preview:generateContent`;

        // Use the same Master Prompt logic
        const masterPrompt = buildStagingPrompt(prompt || "", roomType || "living_room", style || "modern_farmhouse");

        const generationData = await callVertexWithRetry<any>(() => fetch(generationEndpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: masterPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }],
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }]
                },
                generationConfig: {
                    candidateCount: 1,
                    mediaResolution: "MEDIA_RESOLUTION_UNSPECIFIED",
                    temperature: 0.1,
                    // Note: Gemini 3 might support different params, but these are standard for current gen.
                }
            })
        }));

        // Extract Image
        const generatedImageBase64 = generationData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        const mimeType = generationData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.mimeType || "image/jpeg";

        if (generatedImageBase64) {
            return NextResponse.json({
                result: `data:${mimeType};base64,${generatedImageBase64}`,
                projectId: finalProjectId,
                editsRemaining: newEditsRemaining
            });
        }

        const text = generationData.candidates?.[0]?.content?.parts?.[0]?.text;
        return NextResponse.json({ error: `Model returned text: "${text?.substring(0, 200)}..."` }, { status: 500 });

    } catch (error: any) {
        console.error("Stage Pro API Error:", error);
        const message = error.message || "Internal Server Error";
        const status = (error as any).status || 500;

        if (message === "Insufficient credits") return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
        if (message === "No edits remaining for this project") return NextResponse.json({ error: "No edits remaining." }, { status: 403 });
        if (message === "Service busy") return NextResponse.json({ error: "Service busy" }, { status: 503 });

        return NextResponse.json({ error: message }, { status: status });
    }
}
