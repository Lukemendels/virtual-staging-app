// ============================================================================
// prompt-engine.ts
// ============================================================================

// 1. INTERIOR MARKET ONTOLOGY
// ----------------------------------------------------------------------------
export const MARKET_TIERS: Record<string, string> = {
    modern_farmhouse:
        "Style: Modern Farmhouse. Textures: Matte black metal, raw oak wood grain, heavy linen fabrics, chunky knit throws. Vibe: Airy, organic, high-contrast neutrals. Lighting interaction: Soft diffusion.",
    historic:
        "Style: Transitional Historic. Textures: Aged mahogany, tufted velvet (sheen), brass accents (reflective), persian wool rugs. Vibe: Stately, collected, warm richness. Lighting interaction: Warm tungsten highlights.",
    luxury:
        "Style: Luxury Contemporary. Textures: Italian boucle fabric, travertine stone (porous), polished chrome, low-profile leather. Vibe: Gallery-like, expensive, curated. Lighting interaction: High contrast shadows.",
    industrial:
        "Style: Industrial Loft. Textures: Distressed cognac leather, cold rolled steel, reclaimed rough-sawn wood, cowhide. Vibe: Masculine, raw, structural. Lighting interaction: Moody, directional.",
    scandi:
        "Style: Scandi-Minimalist. Textures: Blonde ash wood, matte grey felt, sheepskin, ceramics. Vibe: Hygge, clean lines, functional. Lighting interaction: Bright, even wash.",
    accessible:
        "Style: Transitional Real Estate Standard. Textures: Durable grey tweed, espresso wood finish, glass surfaces, plush neutral rugs. Vibe: Safe, inviting, open. Lighting interaction: Neutral balanced."
};

// 2. EXTERIOR LANDSCAPING ONTOLOGY (NEW)
// ----------------------------------------------------------------------------
export const EXTERIOR_TIERS: Record<string, string> = {
    curb_appeal:
        "Style: Real Estate Curb Appeal. Visuals: Freshly mulched flower beds, vibrant green lawn (striping), blooming hydrangeas, potted boxwoods by the door. Vibe: Welcoming, manicured, clean.",
    modern_zen:
        "Style: Modern Xeriscape/Zen. Visuals: Concrete pavers with river rock gaps, ornamental grasses, bamboo, architectural agave plants, slate gray planters. Vibe: Low-maintenance, architectural, calm.",
    resort_luxury:
        "Style: Backyard Resort. Visuals: Teak lounge chairs with white cushions, blue pool water, stone fire pit, string lights, tropical palms or privacy hedges. Vibe: Vacation, expensive, entertaining.",
    english_garden:
        "Style: Cottage Garden. Visuals: Wildflowers, climbing roses on trellises, winding brick paths, wrought iron benches, lush overgrowth. Vibe: Romantic, organic, timeless.",
    suburban_patio:
        "Style: Family Patio. Visuals: Dining set with umbrella, BBQ grill area, durable outdoor rug, play area background, neat shrubbery. Vibe: Functional, family-friendly, social."
};

// 3. UTILITIES
// ----------------------------------------------------------------------------
const EXTERIOR_TYPES = ["front_yard", "backyard", "patio", "deck", "pool", "terrace", "balcony", "garden", "exterior"]; // Added "exterior" as a catch-all

function isExterior(roomType: string): boolean {
    return EXTERIOR_TYPES.includes(roomType.toLowerCase());
}

// 4. PROMPT CONSTRUCTION ENGINE
// ----------------------------------------------------------------------------

export function buildStagingPrompt(userPrompt: string, roomType: string, style: string, modelVersion: "v2" | "v3" = "v2"): string {

    // A. Detect Context (Interior vs Exterior)
    const exteriorMode = isExterior(roomType);

    // B. Select correct ontology
    // If exterior mode, try to find the style in EXTERIOR_TIERS, fallback to CURB APPEAL.
    // If interior mode, try to find in MARKET_TIERS, fallback to FARMHOUSE.
    let selectedStyle = "";
    if (exteriorMode) {
        selectedStyle = EXTERIOR_TIERS[style] || EXTERIOR_TIERS["curb_appeal"];
    } else {
        selectedStyle = MARKET_TIERS[style] || MARKET_TIERS["modern_farmhouse"];
    }

    // --- V3: GEMINI 3 PRO (The "Expert Designer") ---
    if (modelVersion === "v3") {
        return `
        ROLE: You are an expert ${exteriorMode ? "Landscape Architect and Exterior Designer" : "Interior Architect and Feng Shui Consultant"}.
        GOAL: ${exteriorMode ? "Enhance curb appeal and outdoor living potential." : "Stage this room to maximize 'Buyer Emotional Safety' and spatial flow."}

        1. LIGHTING & PHYSICS (The Realism Layer):
           - ${exteriorMode ? "SUN DIRECTION: Match the sun angle and cast hard shadows from trees/structures." : "Anchor furniture with ambient occlusion shadows."}
           - ${exteriorMode ? "FOLIAGE: Plants must look organic and interact with the wind/gravity (no stiff models)." : "Match the color temperature of the existing light."}
           - Respect the ${exteriorMode ? "ground plane/terrain" : "floor plane"} and vanishing points absolutely.

        2. SPATIAL PSYCHOLOGY (${exteriorMode ? "Curb Appeal" : "Feng Shui"}):
           ${exteriorMode ? getExteriorPsychology(roomType) : getInteriorPsychology()}

        3. AESTHETIC & TEXTURE:
           ${selectedStyle}

        4. LAYOUT SPECIFICS:
           ${exteriorMode ? getV3ExteriorLayout(roomType) : getV3InteriorLayout(roomType)}

        5. USER OVERRIDE:
           ${userPrompt ? `CRITICAL INSTRUCTION: ${userPrompt}` : "Optimize for a high-value real estate listing."}

        NEGATIVE CONSTRAINTS (STRICT):
        - NO blocking the ${exteriorMode ? "front door, driveway, or windows" : "camera view"}.
        - NO floating objects.
        - NO ${exteriorMode ? "changing the house structure, siding, or roof" : "structural changes to walls or ceiling"}.
        - ${exteriorMode ? "NO dead plants or brown grass." : "NO clutter."}
        `;
    }

    // --- V2: GEMINI 2.5 FLASH (The "Production Worker" - LEGACY MODE) ---
    // Reverted to simple, proven prompt structure to avoid over-constraint.
    return `
    Role: Expert Interior Designer.
    Task: Virtually stage this photo with photorealistic furniture.
    Room Type: ${roomType}
    Design Style: ${selectedStyle}
    
    Instructions:
    - Place furniture to showcase the room's best features.
    - Ensure all items are scaled correctly to the room.
    - Match lighting, shadows, and perspective of the original photo perfectly.
    - ${exteriorMode ? "Focus on landscaping and outdoor furniture." : "Focus on appropriate furniture layout for this room type."}

    ${userPrompt ? `USER OVERRIDE: ${userPrompt}` : ""}

    Constraints:
    - Do not change structural elements (walls, windows, floors).
    - Do not cover the foreground or camera lens.
    - Keep the room looking spacious.
    `;
}

// 5. HELPER FUNCTIONS (LAYOUT & PSYCHOLOGY)
// ----------------------------------------------------------------------------

function getInteriorPsychology(): string {
    return `
    - COMMAND POSITION: The primary furniture must face the entry or focal point.
    - CHI FLOW: Maintain wide, clear walking paths.
    - BALANCE: Balance visual weight across the image.
    `;
}

function getExteriorPsychology(roomType: string): string {
    if (roomType === "front_yard") {
        return `
        - WELCOMING ENTRY: Lead the eye to the front door. Use plants to frame the entrance, not block it.
        - CLEAN LINES: Ensure edging between grass and beds is sharp.
        `;
    }
    return `
    - OUTDOOR LIVING: Create distinct zones for sitting vs. playing.
    - PRIVACY: Use tall plants or hedges to screen unsightly background elements if necessary.
    `;
}

function getV3InteriorLayout(roomType: string): string {
    switch (roomType) {
        case "living_room":
        case "great_room":
            return "LAYOUT: Create a 'Social Circle'. Orient the sofa in the Command Position. Anchor with a large rug.";
        case "bedroom":
        case "master_bedroom":
            return "LAYOUT: Place bed on the 'Power Wall' (opposite door). Avoid 'Coffin Position'. Use matching nightstands.";
        case "dining":
        case "dining_room":
            return "LAYOUT: Center the table. Ensure chairs are pulled out slightly. Use a round table if square room.";
        case "home_office":
            return "LAYOUT: Desk in Command Position. Chair backing a solid wall.";
        case "basement":
            return "LAYOUT: Media Lounge configuration. Comfortable sectional facing the best TV wall. Add warmth with rugs and lighting.";
        default:
            return "LAYOUT: Open center, active corners with light/plants.";
    }
}

function getV3ExteriorLayout(roomType: string): string {
    switch (roomType) {
        case "front_yard":
            return "LAYOUT: Enhance the foundation planting. Add symmetry with matching planters by the door. Ensure the driveway is clear. Green up the lawn.";
        case "backyard":
        case "patio":
        case "deck":
            return "LAYOUT: Create a conversation area. Place outdoor sofas/chairs on the patio surface. If there is a lawn, define the edge with a flower bed.";
        case "pool":
            return "LAYOUT: Resort style. Place lounge chairs in pairs with small side tables. Add rolled towels. Ensure safety clearance around the water edge.";
        case "balcony":
        case "terrace":
            return "LAYOUT: Bistro style. Small table and two chairs angled toward the view. Potted plant in the corner.";
        default:
            return "LAYOUT: clean up the landscaping, add fresh mulch, and place appropriate outdoor seating if space allows.";
    }
}

function getV2InteriorLayout(roomType: string): string {
    // Simplified instructions for Flash
    return "Place appropriate furniture in the center. Ensure realistic scaling.";
}

function getV2ExteriorLayout(roomType: string): string {
    // Simplified instructions for Flash
    return "Add green grass, clean landscaping beds, and appropriate outdoor furniture if a patio exists.";
}

// 6. SYSTEM PROMPTS
// ----------------------------------------------------------------------------

export const SYSTEM_PROMPT = `
You are a Real Estate Visualization Engine. 
INPUT: An image of a space (Interior or Exterior).
OUTPUT: The same image with photorealistic 3D elements superimposed.

CORE PHYSICS RULES:
1. LIGHT TRANSPORT: Match direction/intensity of original light (Sun or Artificial).
2. CONTACT SHADOWS: Objects touching the ground must have ambient occlusion shadows.
3. PRESERVATION: Do not remove structural elements (Walls, Roofs, Driveways, Siding).
`;

export const REFINE_SYSTEM_PROMPT = `
You are a Precision Image Editor.
INPUT: An image containing RED scribbles/lines.
TASK: Inpaint the area defined by the RED lines based on the user's text prompt.
RULES:
1. THE RED MASK: The red lines indicate exactly where the change must happen.
2. BLENDING: Seamlessly blend into the environment.
3. REMOVAL: The red lines must be removed in the final output.
`;
