import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Fallback pool (used when Gemini is unavailable) ───────────────────────────
const FALLBACK_CHALLENGES = [
  // Exploration
  "Walk a street you've never walked for 5 minutes",
  "Take a different route to a familiar place",
  "Explore your neighbourhood with no destination",
  "Visit a place you've never noticed before",
  "Walk without your phone for 15 minutes",
  "Sit somewhere public and observe for 10 minutes",
  "Go outside at a different time than usual",
  "Find a quiet spot and stay there for 10 minutes",
  "Take 10 photos of random things around you",
  "Walk until you find something interesting",
  // Mental / Discipline
  "Stay off your phone for 30 minutes",
  "Do nothing for 10 minutes — no stimulation",
  "Focus on one task without distraction",
  "Write down 5 goals",
  "Think deeply about one problem for 15 minutes",
  "Meditate for 5 minutes",
  "Finish something you've been delaying",
  "Avoid social media for 3 hours",
  "Reflect on your day for 10 minutes",
  "Control one bad habit today",
  // Fitness
  "Do 20 pushups",
  "Hold a plank for 1 minute",
  "Do 30 squats",
  "Go for a 10-minute walk",
  "Stretch for 10 minutes",
  "Do 10 burpees",
  "Run for 5 minutes",
  "Do a full body workout for 15 minutes",
  "Do jumping jacks for 2 minutes",
  "Do core exercises for 5 minutes",
  // Social
  "Say hi to someone new",
  "Start a small conversation",
  "Compliment someone genuinely",
  "Talk to someone you usually don't",
  "Text someone you haven't talked to in a while",
  "Make someone laugh",
  "Listen fully without interrupting",
  "Thank someone properly",
  "Be extra kind for a day",
  "Stay present in a conversation",
  // Creative
  "Draw something random",
  "Write a short story",
  "Write 10 ideas about anything",
  "Take aesthetic photos",
  "Write your thoughts like a journal",
  "Write a poem — doesn't matter if it's bad",
  "Make a playlist",
  "Think of a business idea",
  "Brainstorm for 10 minutes",
  "Sketch your surroundings",
  // Lifestyle
  "Drink 2 glasses of water",
  "Eat something healthy",
  "Wake up earlier",
  "Clean your room for 10 minutes",
  "Make your bed",
  "Fix one messy thing",
  "Stay hydrated all day",
  "Eat slowly and mindfully",
  "Take a break when needed",
  "Improve one daily habit",
  // Random / Fun
  "Try something you normally wouldn't",
  "Say yes to something random",
  "Do something slightly uncomfortable",
  "Change your routine today",
  "Listen to a new genre of music",
  "Do something spontaneous",
  "Change your environment",
  "Learn 1 random fact",
  "Break your routine once",
  "Reset your vibe",
  // Reflection
  "Write what you learned today",
  "Think about your future self",
  "Write 3 things you did well",
  "Sit and think deeply",
  "Visualize your goals",
  "Accept something you can't change",
  "Think about your priorities",
  "Identify one weakness",
  "Be honest with yourself",
  "Be self-aware",
  // Micro Challenges
  "Take 5 deep breaths",
  "Stand up and stretch",
  "Look away from screen for 2 minutes",
  "Fix your posture",
  "Close your eyes for 30 seconds",
  "Smile for no reason",
  "Move for 1 minute",
  "Think of one goal",
  "Do 5 pushups",
  "Reset your energy",
];

const SYSTEM_PROMPT = `You are the Spindare AI, the engine behind an "anti-scroll" social experiment.
Your job is to generate one personalised physical-world challenge for a user based on their hobbies and study fields.

Rules:
1. Grounded in the physical world — involves doing something, going somewhere, or creating something tangible.
2. Creative, minimalist, and slightly provocative — it should make them think.
3. Achievable in 5–10 minutes.
4. Tailored to the user's DNA (hobbies and study fields).
5. Return ONLY the challenge text. No intro, no emojis (unless essential), no "Sure!" or "Here is your challenge".

Example output: "Find an interesting shadow in your room and trace its outline with your finger."`;

function randomFallback(): string {
  return FALLBACK_CHALLENGES[Math.floor(Math.random() * FALLBACK_CHALLENGES.length)];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { hobbies = [], studyFields = [], level = 1 } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.warn("[generate-challenge] GEMINI_API_KEY not set — using fallback");
      return new Response(
        JSON.stringify({ challenge: randomFallback() }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const traits = [...hobbies, ...studyFields].join(", ") || "general";
    const userContext = `User DNA: ${traits}. User Level: ${level}.`;
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userContext}\n\nGenerate one unique Spindare challenge:`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 120, temperature: 0.9 },
        }),
      }
    );

    if (!geminiRes.ok) {
      console.error("[generate-challenge] Gemini HTTP error:", geminiRes.status);
      return new Response(
        JSON.stringify({ challenge: randomFallback() }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const json = await geminiRes.json();
    const challenge =
      json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || randomFallback();

    return new Response(
      JSON.stringify({ challenge }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-challenge] Error:", err);
    return new Response(
      JSON.stringify({ challenge: randomFallback() }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
