
// debug-prompts.ts
import { buildStagingPrompt } from './src/lib/prompt-engine';

console.log("================================================================================");
console.log("🛠️  PROMPT ENGINE DIAGNOSTIC TOOL");
console.log("================================================================================");

// Define Scenarios
const scenarios = [
    {
        name: "Scenario A: LUXURY INTERIOR (Gemini 3 Pro)",
        roomType: "living_room",
        style: "luxury",
        modelVersion: "v3" as "v3",
        userPrompt: "Make it feel like a Succession penthouse"
    },
    {
        name: "Scenario B: EXTERIOR CURB APPEAL (Gemini 3 Pro)",
        roomType: "front_yard",
        style: "curb_appeal",
        modelVersion: "v3" as "v3",
        userPrompt: "Add some purple flowers"
    },
    {
        name: "Scenario C: INDUSTRIAL BASEMENT (Gemini 2.5 Flash)",
        roomType: "basement",
        style: "industrial",
        modelVersion: "v2" as "v2",
        userPrompt: "" // No specific override
    }
];

// Execute Scenarios
scenarios.forEach((scenario) => {
    console.log(`\n\n--------------------------------------------------------------------------------`);
    console.log(`🧪 ${scenario.name}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`INPUTS: Room=${scenario.roomType}, Style=${scenario.style}, Model=${scenario.modelVersion}`);

    try {
        const result = buildStagingPrompt(
            scenario.userPrompt,
            scenario.roomType,
            scenario.style,
            scenario.modelVersion // Use explicit cast or ensure type safety
        );
        console.log(`\n📄 GENERATED PROMPT:\n${result}`);
    } catch (error) {
        console.error("❌ ERROR GENERATING PROMPT:", error);
    }
});

console.log("\n\n================================================================================");
console.log("✅ DIAGNOSTIC COMPLETE");
console.log("================================================================================");
