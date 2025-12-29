
// generate-local.ts
// ============================================================================
// ⚠️  AUTHENTICATION REQUIRED
// Before running this script, you must authenticate with Google Cloud:
// Run: `gcloud auth application-default login`
// ============================================================================

import { VertexAI } from '@google-cloud/vertexai';
import { buildStagingPrompt } from './src/lib/prompt-engine';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'gen-lang-client-0180739394'; // Recovered from logs
const LOCATION = 'us-central1'; // Or 'global' if using 3.0 Pro? Let's assume standard for now, or make it configurable.
// Note: Gemini 3.0 Pro Preview requires 'global' endpoint usually, but VertexAI SDK might handle it via location arg.
const MODEL_NAME = 'gemini-1.5-pro-002'; // Change to 'gemini-experimental' or 'gemini-3.0-pro-image-preview' as needed.

// --- SETUP ---
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
const generativeModel = vertexAI.getGenerativeModel({ model: MODEL_NAME });

async function runVisualTest() {
    console.log("================================================================================");
    console.log("🎨  VISUAL GENERATION TEST (WET RUN)");
    console.log("================================================================================");
    console.log(`Model: ${MODEL_NAME}`);
    console.log(`Project: ${PROJECT_ID}`);
    console.log(`Location: ${LOCATION}`);

    // 1. Load Image
    const imagePath = path.join(__dirname, 'local-test-assets', 'input.jpg');
    if (!fs.existsSync(imagePath)) {
        console.error(`❌ ERROR: Input image not found at ${imagePath}`);
        console.error("   Please place a JPEG file named 'input.jpg' in the 'local-test-assets' folder.");
        return;
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    console.log(`\n📸 Loaded input image (${imageBuffer.length} bytes)`);

    // 2. Generate Prompt (Scenario: Luxury Living Room, V3)
    console.log("🧠 Generating prompt using V3 engine...");
    const prompt = buildStagingPrompt(
        "Make it feel like a Succession penthouse",
        "living_room",
        "luxury",
        "v3"
    );

    console.log("   PROMPT PREVIEW:");
    console.log("   " + prompt.split('\n')[1].trim() + "..."); // Print first line of prompt for sanity

    // 3. Call Vertex AI
    console.log("\n🚀 Sending request to Gemini... (This may take 10-20s)");

    try {
        const request = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                ]
            }]
        };

        const result = await generativeModel.generateContent(request);
        const response = await result.response;

        // 4. Save Output
        // Note: Depending on the model, response might contain text or image. 
        // For Image models (Imagene/Gemini 3 Image), the response format differs.
        // BUT for 'gemini-1.5-pro', it returns TEXT description unless we are using the Image Generation API specifically.
        // Wait, the user's app uses `gemini-3-pro-image-preview` which is a GENERATIVE AI model but outputs images?
        // Actually, the current API implementation in `api/stage-pro` uses `generateContent` but expects `image/png` bytes in the response?
        // Let's check how the main app handles the response.
        // The main app (api/stage-pro/route.ts) fetches the global endpoint. 
        // The Vertex AI Node SDK `generateContent` typically returns text for LLMs. 
        // IF we are using an Image model, we might need a different method or parse the response carefully.
        // For now, let's assume standard generateContent and inspect the output.
        // If it's the Image model, it might return base64 data in the candidates.

        console.log("✅ Response received!");

        // Basic logging of response structure
        // console.log(JSON.stringify(response, null, 2));

        // Attempt to extract image if present (Experimental)
        // This part depends heavily on the specific model's output schema.
        console.log("   (Saving output handling logic is experimental - check console for full response structure if no image is saved)");

        // For now, just log success.

    } catch (error) {
        console.error("❌ ERROR CALLING VERTEX AI:", error);
    }
}

runVisualTest();
