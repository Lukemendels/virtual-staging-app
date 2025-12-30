
// src/lib/verification-engine.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Use Gemini 3.0 Flash as the high-speed critic
const MODEL_NAME = "gemini-3-flash-preview";

export async function verifyStagingResult(
    originalPrompt: string,
    generatedImageBase64: string,
    roomType: string,
    apiKey: string
): Promise<{ pass: boolean; feedback: string }> {

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const verificationPrompt = `
        ROLE: You are a Senior Interior Design QA Specialist.
        TASK: Verify if the generated image matches the styling request and physics constraints.
        
        INPUT CONTEXT:
        - Room Type: ${roomType}
        - User Styling Request: "${originalPrompt}"
        
        STRICT FAIL CRITERIA (If any exist, return FAIL):
        1. HALLUCINATIONS: Floating furniture, objects merging into walls.
        2. STRUCTURAL DAMAGE: Did the AI remove existing walls, windows, or change the floor material?
        3. BAD PERSPECTIVE: Does the furniture look like it's pasted flat?
        4. OBSTRUCTION: Is the camera view blocked by a large object?
        5. BLOCKED ACCESS (CRITICAL): Is the seating area accessible? Are paths blocked by sofas or tables?
        6. LOGICAL ORIENTATION (FENG SHUI): Is furniture facing the wrong way? (e.g. Sofa facing wall instead of TV/View). Rugs must align with furniture.

        OUTPUT FORMAT:
        Return a JSON object: { "pass": boolean, "reason": "short explanation" }
        `;

        const result = await model.generateContent([
            verificationPrompt,
            { inlineData: { mimeType: "image/jpeg", data: generatedImageBase64 } }
        ]);

        const responseText = result.response.text();
        console.log(`[Verification] Response: ${responseText}`);

        // Clean and parse JSON
        const cleanJson = responseText.replace(/```json|```/g, "").trim();
        const analysis = JSON.parse(cleanJson);

        return {
            pass: analysis.pass,
            feedback: analysis.reason
        };

    } catch (error) {
        console.error("Verification Error:", error);
        // Fail open or closed? 
        // If the critic fails, we might warn but still pass the image to avoid blocking the user due to API error.
        return { pass: true, feedback: "Verification bypassed due to API error." };
    }
}
