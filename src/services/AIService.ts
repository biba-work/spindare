import { GoogleGenerativeAI } from "@google/generative-ai";

export type HobbyType = "Reading" | "Gaming" | "Fitness" | "Cooking" | "Art" | "Photography" | "Hiking" | "Music";

export type StudyFieldType = "Computer Science" | "Business" | "Engineering" | "Medicine" | "Arts" | "Law" | "Physics" | "Design";

export interface UserProfile {
    username: string;
    email: string;
    hobbies: HobbyType[];
    studyFields: StudyFieldType[];
    xp: number;
    level: number;
    spinsLeft?: number;
    lastSpinTimestamp?: number;
    photoURL?: string;
}

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Fallback pool used when Gemini is unavailable — pick one at random
const FALLBACK_CHALLENGES = [
    "Take a photo of something that reminds you of silence.",
    "Write down one thing you've never told anyone.",
    "Ask a stranger what their favourite memory is.",
    "Walk for 10 minutes without looking at any screen.",
    "Draw how you feel right now using only circles.",
    "Find an interesting shadow and trace its outline with your finger.",
    "Stare at the sky for exactly 60 seconds.",
    "Write a letter you'll never send.",
    "Eat your next meal with zero distractions, no phone.",
    "Spend 2 hours in complete silence and notice what changes.",
    "Touch five different textures in the next 5 minutes.",
    "Photograph something broken that looks beautiful.",
    "Close your eyes for 3 full minutes and only listen.",
    "Go the entire day without checking how you look in a mirror.",
    "Find the most interesting shadow near you and photograph it.",
    "Do one thing today that scares you slightly.",
    "Write down three things you're carrying that you haven't said out loud.",
    "Stand in one spot outside for 10 minutes and observe.",
    "Photograph the most overlooked object in your space.",
    "Lie on the floor for 5 minutes. Notice the ceiling.",
];

const SYSTEM_PROMPT = `
You are the Spindare AI, the core of the "Anti-Scroll" social experiment. 
Your goal is to turn digital intent into physical action through "Active Reveal" challenges.
Challenges must be:
1. Grounded in the physical world (photos, reflections, physical movement).
2. Creative, minimalist, and slightly provocative.
3. achievable in 5-10 minutes.
4. Related to the user's "DNA" (hobbies and study fields).

Format: Return ONLY the challenge text. No intro, no emojis (unless essential), no "Sure!" or "Here is your challenge".
Example: "Find an interesting shadow in your room and trace its outline with your finger."
`;

export const AIService = {
    generateChallenge: async (profile: UserProfile): Promise<string> => {
        try {
            const traits = [...profile.hobbies, ...profile.studyFields].join(", ");
            const userContext = `User DNA: ${traits}. User Level: ${profile.level}.`;

            const prompt = `${SYSTEM_PROMPT}\n\n${userContext}\n\nGenerate one unique Spindare challenge:`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();

            return text || FALLBACK_CHALLENGES[Math.floor(Math.random() * FALLBACK_CHALLENGES.length)];
        } catch (error) {
            console.error("Gemini Error:", error);
            return FALLBACK_CHALLENGES[Math.floor(Math.random() * FALLBACK_CHALLENGES.length)];
        }
    },

    // TODO: Replace with real Gemini analysis once completion media is uploaded.
    // Currently returns a random placeholder string — NOT real AI analysis.
    analyzeCompletion: (_challenge: string, _profile: UserProfile): string => {
        const insights = [
            "Your 'Adventurous' trait is growing. I noticed your speed.",
            "Visual creativity detected. Adding +5 bonus XP for composition.",
            "Social barrier broken. Your 'Extroverted' score has improved.",
            "AI Analysis: Effort levels are optimal for your current Tier."
        ];
        return insights[Math.floor(Math.random() * insights.length)];
    }
};
