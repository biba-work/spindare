export type PersonalityType = "Adventurous" | "Creative" | "Calm" | "Introverted" | "Extroverted" | "Risk-taker" | "Thinker";
export type InterestType = "Nature" | "Tech" | "Art" | "Sports" | "Music" | "Food" | "Travel" | "Coding";

export interface UserProfile {
    username: string;
    personality: PersonalityType[];
    interests: InterestType[];
    xp: number;
    level: number;
}

const CHALLENGE_POOL: Record<string, string[]> = {
    Adventurous: [
        "Find the highest point you can safely reach and take a panorama.",
        "Talk to someone you've never met and ask about their craziest travel story.",
        "Go for a 15-minute walk in a direction you never usually go."
    ],
    Creative: [
        "Rearrange three items in your room to create a 'still life' and photo it.",
        "Draw a quick sketch of the first person you see (or a pet).",
        "Find a strange texture in your environment and take a macro photo."
    ],
    RiskTaker: [
        "Compliment a total stranger on something specific.",
        "Do 10 pushups in a public place right now.",
        "Ask a shopkeeper what their most underrated product is."
    ],
    Tech: [
        "Take a photo of a piece of tech that changed your life.",
        "Explain a complex tech concept to someone using only simple words.",
        "Find a hidden 'easter egg' or detail in your current software tools."
    ],
    Nature: [
        "Find a leaf or stone with an interesting shape and photograph it.",
        "Sit in silence for 2 minutes and list every natural sound you hear.",
        "Find a plant growing in an unexpected place."
    ]
};

export const AIService = {
    generateChallenge: (profile: UserProfile): string => {
        // High-level AI Logic Simulation:
        // 1. Combine personality and interests
        // 2. Filter pool based on those traits
        // 3. Add difficulty based on level

        const traits = [...profile.personality, ...profile.interests];
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
