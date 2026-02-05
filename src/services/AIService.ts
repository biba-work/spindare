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
    connectionPrivacy?: 'open' | 'private';
    uid?: string;
}

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

            return text || "Take a photo of something that reminds you of silence.";
        } catch (error) {
            console.error("Gemini Error:", error);
            return "Take a photo of something that reminds you of silence.";
        }
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
