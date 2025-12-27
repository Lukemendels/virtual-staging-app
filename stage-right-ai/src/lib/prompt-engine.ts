// ============================================================================
// 1. MARKET ONTOLOGY (VISUALS ONLY)
// ============================================================================
// Minimized descriptions to prevent token overload.

export const MARKET_TIERS: Record<string, string> = {
    modern_farmhouse: "Furniture Style: Modern Farmhouse. Visuals: Linen slipcovered sofas, chunky oak tables, black metal accents, cream wool rugs, eucalyptus greenery.",

    historic: "Furniture Style: Transitional Historic. Visuals: Tufted velvet armchairs, mahogany chests, brass glass tables, persian rugs, oil paintings.",

    luxury: "Furniture Style: Luxury Contemporary. Visuals: Low Italian leather sectionals, bouclé chairs, stone tables, minimalist sculpture.",

    industrial: "Furniture Style: Industrial Chic. Visuals: Cognac leather sofas, steel shelving, reclaimed wood tables, cowhide rugs.",

    scandi: "Furniture Style: Scandi-Minimalist. Visuals: Light ash wood, grey fabric sofas, nesting tables, geometric wool rugs.",

    accessible: "Furniture Style: Transitional. Visuals: Grey sofas, sturdy wood tables, blue and white pillows, soft rugs."
};

// ============================================================================
// 2. PROMPT CONSTRUCTION ENGINE (SIMPLIFIED)
// ============================================================================

export function buildStagingPrompt(userPrompt: string, roomType: string, style: string): string {

    // A. THE PRIME DIRECTIVE (Short & Punchy)
    // We use "Inpaint" terminology which Flash understands well.
    const coreTask = `
    TASK: Inpaint realistic 3D furniture into the empty floor space of this room.
    CONSTRAINT: The existing walls, ceiling, windows, and flooring are FROZEN. Do not change them.
    `;

    // B. VISUAL STYLE
    const visualStyle = `
    AESTHETIC: ${MARKET_TIERS[style] || MARKET_TIERS["modern_farmhouse"]}
    `;

    // C. SIMPLE PLACEMENT (Replaces Complex Spatial Logic)
    // Instead of "Zoning", we just say "Place X here".
    let placementGuide = "";
    switch (roomType) {
        case "basement":
            // OLD: "Zone with 2 rugs, create media area..." (Too complex)
            // NEW: Simple placement.
            placementGuide = "PLACEMENT: Place a sofa and coffee table in the center of the carpet. Add a TV stand against the far wall.";
            break;
        case "bonus_room":
        case "bedroom":
            placementGuide = "PLACEMENT: Place a bed or seating area centrally. Keep low to respect ceiling height.";
            break;
        case "great_room":
        case "living_room":
            placementGuide = "PLACEMENT: Arrange a conversation area with a sofa and chairs around a central rug.";
            break;
        case "dining":
        case "dining_room":
            placementGuide = "PLACEMENT: Place a dining table and chairs in the center of the room.";
            break;
        default:
            placementGuide = "PLACEMENT: Place appropriate furniture in the center of the open floor space.";
            break;
    }

    // D. USER REQUEST (Simplified)
    const userRequest = userPrompt ? `USER NOTE: Include ${userPrompt} if it fits naturally.` : "";

    // E. NEGATIVE PROMPT (The "Don't" List)
    // We combine the guardrails into a single negative prompt block which models often process better as a stop-list.
    const constraints = `
    STRICT NEGATIVE CONSTRAINTS:
    - NO removing or moving walls, bulkheads, or soffits.
    - NO changing the ceiling grid or flooring material.
    - NO changing windows or views.
    - NO construction or remodeling.
    - NO new room geometry.
    `;

    return `${coreTask}\n${visualStyle}\n${placementGuide}\n${userRequest}\n${constraints}`;
}

// ============================================================================
// 3. SYSTEM PROMPT (The "Constitution")
// ============================================================================
// We keep this high-level but cleaner.

export const SYSTEM_PROMPT = `
You are a Virtual Staging AI. Your goal is to overlay 3D furniture onto a 2D image.
1. PRESERVE GEOMETRY: You must treat the input image as a fixed background. Never alter the structural lines (walls, ceiling, floor edges).
2. REALISTIC SCALE: Furniture must be sized correctly for the room. If the room is small, use smaller furniture.
3. LIGHTING MATCH: The furniture lighting must match the room's existing light sources.
`;

export const REFINE_SYSTEM_PROMPT = `You are an expert editor. Modify the provided image ONLY according to the user's request.
VISUAL PROMPTING: If the image contains bright RED marker lines or scribbles, these are USER ANNOTATIONS representing a mask.
- TREATMENT: The red marked area is the TARGET for editing.
- ACTION: Apply the user's text request specifically to the area covered by the red marks.
- CLEANUP: You MUST remove the red marker lines in the final output and inpaint the background naturally.`;
