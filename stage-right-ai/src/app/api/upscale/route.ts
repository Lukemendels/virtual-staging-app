import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { callVertexWithRetry } from "@/lib/vertex-utils";

// 1. Initialize Firebase Admin if not already running
if (!admin.apps.length) {
    try {
        let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string;
        if (!serviceAccountKey.trim().startsWith("{")) {
            serviceAccountKey = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } catch (error) {
        console.error("Firebase Admin Init Error:", error);
    }
}

export async function POST(request: Request) {
    try {
        const { image } = await request.json();

        if (!image) {
            return NextResponse.json({ error: "Image is required" }, { status: 400 });
        }

        // Clean the base64 string
        const base64Image = image.replace(/^data:image\/\w+;base64,/, "");

        // 2. Get the Project ID and Access Token from your Service Account
        let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string;
        if (!serviceAccountKey.trim().startsWith("{")) {
            serviceAccountKey = Buffer.from(serviceAccountKey, "base64").toString("utf-8");
        }
        const serviceAccount = JSON.parse(serviceAccountKey);
        const projectId = serviceAccount.project_id;

        // Get a fresh OAuth2 token
        const accessTokenObj = await admin.app().options.credential?.getAccessToken();
        const accessToken = accessTokenObj?.access_token;

        if (!accessToken) {
            throw new Error("Failed to generate Access Token from Service Account.");
        }

        console.log("🔹 Authenticated. Requesting 4K Upscale from Vertex AI (US Central 1)...");

        // 3. Call the Vertex AI "Predict" Endpoint (Imagen 2 Upscaling - Stable)
        // Model: image-generation-002
        // Location: us-central1
        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/image-generation-002:predict`;

        const data = await callVertexWithRetry<any>(() => fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                instances: [
                    {
                        image: {
                            bytesBase64Encoded: base64Image,
                        },
                    },
                ],
                parameters: {
                    mode: "upscale",
                    upscaleConfig: {
                        upscaleFactor: "x2", // 2K -> 4K
                    },
                },
            }),
        }));

        // 4. Extract and Return the Image
        const upscaledImageBase64 = data.predictions?.[0]?.bytesBase64Encoded;

        if (!upscaledImageBase64) {
            throw new Error("No image returned from Vertex AI.");
        }

        return NextResponse.json({
            result: `data:image/png;base64,${upscaledImageBase64}`
        });

    } catch (error: any) {
        console.error("Upscale Critical Failure:", error);
        const message = error.message || "Internal Server Error";
        const status = (error as any).status || 500;

        if (message === "Service busy") {
            return NextResponse.json({ error: "Service busy" }, { status: 503 });
        }

        return NextResponse.json(
            { error: message },
            { status: status }
        );
    }
}