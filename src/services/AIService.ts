export type HobbyType = "Reading" | "Gaming" | "Fitness" | "Cooking" | "Art" | "Photography" | "Hiking" | "Music";
export type StudyFieldType = "Computer Science" | "Business" | "Engineering" | "Medicine" | "Arts" | "Law" | "Physics" | "Design";

export interface UserProfile {
    username: string;
    hobbies: HobbyType[];
    studyFields: StudyFieldType[];
    xp: number;
    level: number;
}

const CHALLENGE_POOL: Record<string, string[]> = {
    Reading: [
        "Find a book in your house, open randomly, and photograph the most interesting word you find.",
        "Write a 1-sentence summary of the last thing you read.",
        "Rearrange your books by color and take a photo."
    ],
    Gaming: [
        "Take a photo of your gaming setup (or your controller/mouse).",
        "Describe your favorite game character to someone without naming them.",
        "Perform a victory dance like your favorite game character."
    ],
    Fitness: [
        "Do 15 squats right now and take a sweaty selfie.",
        "Go for a 5-minute fast walk and track it.",
        "Strike a bodybuilding pose in front of a mirror."
    ],
    Cooking: [
        "Plate your next meal like a Michelin-star chef and photograph it.",
        "Find an ingredient in your kitchen you haven't used in a month.",
        "Record a 10-second 'cooking tutorial' for a simple snack."
    ],
    Art: [
        "Draw a doodle of an 'S' in a style that represents your day.",
        "Find an interesting shadow and trace it with your finger or drawing tool.",
        "Mix two colors from anything in your room (clothes, objects) visually."
    ],
    Photography: [
        "Take a macro photo of an everyday object from an extreme angle.",
        "Find a perfect reflection in a window or puddle.",
        "Capture a photo that uses 'leading lines' in your current room."
    ],
    "Computer Science": [
        "Take a photo of a piece of 'hardware' that looks like it's from the future.",
        "Explain what a 'loop' is to someone using only kitchen analogies.",
        "Find a line of code or a terminal prompt and photograph it."
    ],
    Business: [
        "Pitch your current room as a 'premium startup office' to your camera.",
        "Find a product with the best packaging in your house.",
        "Write down a 1-sentence business idea for a local cafe."
    ],
    Engineering: [
        "Find something in your room that is 'over-engineered' and photograph it.",
        "Sketch a quick diagram of how your door handle works.",
        "Balance three objects on top of each other and photograph the tower."
    ],
    Medicine: [
        "Check your pulse and record it, or find a medical term you don't know.",
        "Take a photo of something that makes you feel 'rejuvenated'.",
        "Perform a 30-second mindfulness breathing exercise."
    ]
};

export const AIService = {
    generateChallenge: (profile: UserProfile): string => {
        // High-level AI Logic Simulation:
        // 1. Combine personality and interests
        // 2. Filter pool based on those traits
        // 3. Add difficulty based on level

        const traits = [...profile.hobbies, ...profile.studyFields];
        let available = traits.flatMap(trait => CHALLENGE_POOL[trait] || []);

        if (available.length === 0) {
            available = [
                "Take a photo of something that reminds you of silence.",
                "Write down one thing you've never told anyone."
            ];
        }

        const base = available[Math.floor(Math.random() * available.length)];

        // Add "AI Tone" based on level
        if (profile.level >= 5) {
            return `[DARE MASTER L5] ${base} - Must be completed within 10 minutes.`;
        }

        return base;
    },

    analyzeCompletion: (challenge: string, profile: UserProfile) => {
        // Simulated AI insight
        const insights = [
            "Your 'Adventurous' trait is growing. I noticed your speed.",
            "Visual creativity detected. Adding +5 bonus XP for composition.",
            "Social barrier broken. Your 'Extroverted' score has improved.",
            "AI Analysis: Effort levels are optimal for your current Tier."
        ];
        return insights[Math.floor(Math.random() * insights.length)];
    }
};
