// SoundService — safe dynamic require so Metro never 500s if expo-av isn't installed
// expo-av must be installed (`npx expo install expo-av`) for actual sound; haptics always work.
import * as Haptics from 'expo-haptics';

// Dynamic require — if expo-av isn't installed yet, Audio stays null and sounds are silently skipped
let Audio: any = null;
try {
    const expoAv: any = require('expo-av');
    Audio = expoAv.Audio ?? expoAv.default?.Audio ?? expoAv;
    if (!Audio) throw new Error('expo-av did not expose Audio');
} catch (err) {
    console.warn('[SoundService] expo-av not installed or failed to load — sounds disabled, haptics still work', err);
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
            allowsRecordingIOS: false,
            interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
            playsInSilentModeIOS: true,   // allow app sounds even when the device is muted
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
            playThroughEarpieceAndroid: false,
        });
        audioReady = true;
    } catch (err) {
        console.warn('[SoundService] failed to set audio mode', err);
    }
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
