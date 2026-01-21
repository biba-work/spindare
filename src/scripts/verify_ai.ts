import { AIService, UserProfile } from '../services/AIService.ts';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verify() {
    console.log("--- Spindare AI Service Verification ---");

    const mockProfile: UserProfile = {
        username: "bibovic",
        hobbies: ["Photography", "Gaming"],
        studyFields: ["Computer Science"],
        xp: 248,
        level: 3
    };

    console.log("Generating challenge for profile:", mockProfile);

    try {
        const challenge = await AIService.generateChallenge(mockProfile);
        console.log("\n✅ AI Challenge Generated:");
        console.log(`"${challenge}"`);

        if (challenge.length > 5 && !challenge.includes(" silence")) {
            console.log("\nSuccess: Received a unique, dynamic challenge!");
        } else {
            console.log("\nNotice: Received a fallback or very short challenge. Check API response.");
        }
    } catch (error) {
        console.error("\n❌ Verification Failed:", error);
    }
}

verify();
