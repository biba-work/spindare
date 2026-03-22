// SoundService — safe dynamic require so Metro never 500s if expo-av isn't installed
// expo-av must be installed (`npx expo install expo-av`) for actual sound; haptics always work.
import * as Haptics from 'expo-haptics';

// Dynamic require — if expo-av isn't installed yet, Audio stays null and sounds are silently skipped
let Audio: any = null;
try {
    Audio = require('expo-av').Audio;
} catch {
    console.warn('[SoundService] expo-av not installed — sounds disabled, haptics still work');
}

// ── Sound assets ─────────────────────────────────────────────────────────────
const SOUNDS: Record<string, any> = {
    reaction:       require('../../assets/sounds/reaction.wav'),
    postSuccess:    require('../../assets/sounds/post_success.wav'),
    save:           require('../../assets/sounds/save.wav'),
    spin:           require('../../assets/sounds/spin.wav'),
    challengeDone:  require('../../assets/sounds/challenge_done.wav'),
    messageSent:    require('../../assets/sounds/message_sent.wav'),
};

type SoundKey = keyof typeof SOUNDS;

// Preloaded sound cache
const cache: Partial<Record<SoundKey, any>> = {};
let audioReady = false;

async function ensureAudio() {
    if (!Audio || audioReady) return;
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: false,   // respect the silent switch on iPhone
            staysActiveInBackground: false,
        });
        audioReady = true;
    } catch { /* non-fatal */ }
}

async function getSound(key: SoundKey): Promise<any | null> {
    if (!Audio) return null;
    if (cache[key]) return cache[key]!;
    try {
        await ensureAudio();
        const { sound } = await Audio.Sound.createAsync(SOUNDS[key], { shouldPlay: false, volume: 0.6 });
        cache[key] = sound;
        return sound;
    } catch {
        return null;
    }
}

async function play(key: SoundKey) {
    if (!Audio) return;
    try {
        const sound = await getSound(key);
        if (!sound) return;
        await sound.setPositionAsync(0);
        await sound.playAsync();
    } catch { /* non-fatal — sound is a nice-to-have */ }
}

// ── Haptic helpers ────────────────────────────────────────────────────────────
function hapticLight()   { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
function hapticMedium()  { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
function hapticHeavy()   { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
function hapticSuccess() { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
function hapticError()   { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }

// ── Public API — one call handles both sound + haptic ─────────────────────────
export const SoundService = {

    reaction()     { hapticMedium(); play('reaction'); },
    unreaction()   { hapticLight(); },
    postSuccess()  { hapticSuccess(); play('postSuccess'); },
    save()         { hapticMedium(); play('save'); },
    spinStart()    { hapticLight(); play('spin'); },

    spinLand() {
        hapticHeavy();
        setTimeout(() => hapticMedium(), 80);
        play('challengeDone');
    },

    challengeDone() { hapticSuccess(); play('challengeDone'); },
    messageSent()   { hapticLight(); play('messageSent'); },
    tap()           { hapticLight(); },
    error()         { hapticError(); },

    preloadAll() {
        if (!Audio) return; // skip if expo-av not installed
        Object.keys(SOUNDS).forEach(k => getSound(k as SoundKey));
    },

    async unloadAll() {
        for (const key of Object.keys(cache) as SoundKey[]) {
            try { await cache[key]?.unloadAsync(); } catch { /* ignore */ }
            delete cache[key];
        }
        audioReady = false;
    },
};
