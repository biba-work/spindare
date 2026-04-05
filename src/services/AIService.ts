// ─────────────────────────────────────────────────────────────────────────────
// AIService.ts
//
// Challenge generation runs server-side via a Supabase Edge Function.
// The Gemini API key and full prompt engineering are NOT in this bundle —
// they live exclusively on the server, making them impossible to extract
// from the APK.
// ─────────────────────────────────────────────────────────────────────────────

const EDGE_FUNCTION_URL =
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-challenge`;

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

// Client-side safety net — only used if the Edge Function itself is unreachable
// (e.g. no internet). The interesting prompt logic stays server-side.
const OFFLINE_FALLBACK = [
    "Walk a street you've never walked for 5 minutes",
    "Sit somewhere public and observe for 10 minutes",
    "Stay off your phone for 30 minutes",
    "Do 20 pushups",
    "Compliment someone genuinely",
    "Draw something random",
    "Make your bed and notice how it feels",
    "Take 5 deep breaths and reset",
    "Write 3 things you did well today",
    "Go outside for 10 minutes with no destination",
];

export type HobbyType =
    | "Reading"
    | "Gaming"
    | "Fitness"
    | "Cooking"
    | "Art"
    | "Photography"
    | "Hiking"
    | "Music";

export type StudyFieldType =
    | "Computer Science"
    | "Business"
    | "Engineering"
    | "Medicine"
    | "Arts"
    | "Law"
    | "Physics"
    | "Design";

export interface UserProfile {
    username: string;
    email: string;
    hobbies: HobbyType[];
    studyFields: StudyFieldType[];
    xp: number;
    level: number;
    spinsLeft?: number;
    lastSpinTimestamp?: number;
    streak?: number;
    lastChallengeDate?: string;
    photoURL?: string;
}

function offlineFallback(): string {
    return OFFLINE_FALLBACK[Math.floor(Math.random() * OFFLINE_FALLBACK.length)];
}

export const AIService = {
    generateChallenge: async (profile: UserProfile & { userId?: string }): Promise<string> => {
        try {
            const res = await fetch(EDGE_FUNCTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({
                    hobbies: profile.hobbies,
                    studyFields: profile.studyFields,
                    level: profile.level,
                    userId: profile.userId ?? "anonymous",
                }),
            });

            if (!res.ok) {
                console.error("[AIService] Edge Function error:", res.status);
                return offlineFallback();
            }

            const { challenge } = await res.json();
            return challenge || offlineFallback();
        } catch (err) {
            console.error("[AIService] Network error:", err);
            return offlineFallback();
        }
    },

    analyzeCompletion: async (challenge: string, profile: UserProfile): Promise<string> => {
        try {
            const res = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-completion`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({ challenge, level: profile.level }),
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { analysis } = await res.json();
            return analysis || offlineFallback();
        } catch (error) {
            console.error('[AIService] analyzeCompletion error:', error);
            return offlineFallback();
        }
    },
};
