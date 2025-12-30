
// generate-local.ts
// ============================================================================
// ⚠️  AUTHENTICATION REQUIRED
// Before running this script, you must authenticate with Google Cloud:
// Run: `gcloud auth application-default login`
// ============================================================================

import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';
import { buildStagingPrompt } from './src/lib/prompt-engine';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'gen-lang-client-0180739394';
const LOCATION = 'global'; // Gemini 3.0 Pro Image Preview requires global endpoint
const MODEL_NAME = 'gemini-3-pro-image-preview';

// --- SETUP ---
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

const generativeModel = vertexAI.getGenerativeModel({
    model: MODEL_NAME,
    // Safety settings (optional but good practice)
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ]
});

async function runVisualTest() {
    console.log("================================================================================");
    console.log("🎨  VISUAL GENERATION TEST (GEMINI 3 PRO)");
    console.log("================================================================================");
    console.log(`Model: ${MODEL_NAME}`);
    console.log(`Location: ${LOCATION}`);
    console.log(`Project: ${PROJECT_ID}`);

    // 1. Load Image
    const assetsDir = path.join(__dirname, 'local-test-assets');
    const imagePath = path.join(assetsDir, 'input.jpg');

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
    console.log("   " + prompt.split('\n')[1].trim() + "...");

    // 3. Call Vertex AI
    console.log("\n🚀 Sending request to Gemini 3 Pro... (This may take 10-20s)");

    try {
        const request = {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
                ]
            }],
            generationConfig: {
                candidateCount: 1,
                temperature: 0.1, // Creative but controlled
            }
        };

        const result = await generativeModel.generateContent(request);
        const response = await result.response;

        console.log("✅ Response received!");

        // 4. Save Output
        const candidates = response.candidates;
        const firstCandidate = candidates?.[0];

        // Gemini 3.0 Pro Image response typically puts the image in inlineData
        const inlineData = firstCandidate?.content?.parts?.find(p => p.inlineData)?.inlineData;

        if (inlineData && inlineData.data) {
            const outputBuffer = Buffer.from(inlineData.data, 'base64');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFilename = `output-${timestamp}.jpeg`;
            const outputPath = path.join(assetsDir, outputFilename);

            fs.writeFileSync(outputPath, outputBuffer);
            console.log(`\n🎉 SUCCESS! Generated image saved to:`);
            console.log(`   ${outputPath}`);
        } else {
            console.warn("⚠️  No image data found in response. Checking for text...");
            const textPart = firstCandidate?.content?.parts?.find(p => p.text);

            if (textPart) {
                console.log(`\n❌ MODEL RETURNED TEXT INSTEAD OF IMAGE:`);
                console.log(`"${textPart.text}"`);
                console.log("\nUsing 'gemini-3-pro-image-preview' should return an image. If it returns text, it might be a safety block or prompt issue.");
            } else {
                console.log("   Full Response Object:", JSON.stringify(response, null, 2));
            }
        }

    } catch (error) {
        console.error("❌ ERROR CALLING VERTEX AI:", error);
    }
}

runVisualTest();
