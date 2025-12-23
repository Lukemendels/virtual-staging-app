import { NextResponse } from "next/server";
import { REFINE_SYSTEM_PROMPT } from "@/lib/prompt-engine";
import * as admin from "firebase-admin";

// Helper to get Access Token
async function getAccessToken() {
    const accessTokenObj = await admin.app().options.credential?.getAccessToken();
    return accessTokenObj?.access_token;
}

// Helper to get Project ID
function getProjectId() {
    let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string;
    if (!serviceAccountKey.trim().startsWith("{")) {
        serviceAccountKey = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
    }
    const serviceAccount = JSON.parse(serviceAccountKey);
    return serviceAccount.project_id;
}

export async function POST(request: Request) {
    try {
        const { image, tweakPrompt } = await request.json();

        if (!image || !tweakPrompt) {
            return NextResponse.json(
                { error: "Image and tweak prompt are required" },
                { status: 400 }
            );
        }

        // Remove the data URL prefix if present
        const base64Image = image.replace(/^data:image\/\w+;base64,/, "");

        // Authenticate
        const gcpProjectId = getProjectId();
        const accessToken = await getAccessToken();

        if (!accessToken) {
            throw new Error("Failed to generate Access Token");
        }

        // Use Gemini 2.5 Flash Image (Consistent with Stage API)
        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${gcpProjectId}/locations/us-central1/publishers/google/models/gemini-2.5-flash-image:generateContent`;

        const fullPrompt = `${REFINE_SYSTEM_PROMPT} User Request: ${tweakPrompt}`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [
                        { text: fullPrompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }],
                generationConfig: {
                    // Enforce 2K / Standard
                    candidateCount: 1,
                    mediaResolution: "MEDIA_RESOLUTION_UNSPECIFIED"
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Gemini API Error:", data.error);
            throw new Error(data.error.message || "Gemini API Error");
        }

        // Check for image in the response
        const generatedImageBase64 = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        const mimeType = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.mimeType || "image/jpeg";

        if (generatedImageBase64) {
            return NextResponse.json({ result: `data:${mimeType};base64,${generatedImageBase64}` });
        }

        // Fallback if no image is returned
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        console.warn("Gemini returned text instead of image during refine:", text);
        return NextResponse.json({ error: `Model returned text instead of image: "${text?.substring(0, 200)}..."` }, { status: 500 });

    } catch (error: any) {
        console.error("Refine API Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to refine image." },
            { status: 500 }
        );
    }
}
