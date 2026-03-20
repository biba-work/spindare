/**
 * errorMessages.ts
 * Converts raw technical errors from Clerk, Supabase, and network
 * into clean, human-friendly strings safe to show in the UI.
 */

// Map of Clerk error codes → friendly messages
const CLERK_ERRORS: Record<string, string> = {
    form_password_length_too_short:   "Your password needs to be at least 8 characters.",
    form_password_too_short:          "Your password needs to be at least 8 characters.",
    form_identifier_not_found:        "No account found with that email. Want to create one?",
    form_password_incorrect:          "Wrong password. Double-check and try again.",
    form_identifier_exists:           "An account with that email already exists. Try logging in.",
    form_username_invalid_length:     "Username must be between 3 and 20 characters.",
    form_username_invalid_character:  "Username can only contain letters, numbers, and underscores.",
    form_param_nil:                   "Please fill in all fields before continuing.",
    form_param_missing:               "Please fill in all fields before continuing.",
    form_code_incorrect:              "That code doesn't match. Check your email and try again.",
    form_code_expired:                "That code has expired. Request a new one.",
    session_already_exists:           "You're already signed in.",
    too_many_requests:                "Too many attempts. Please wait a moment and try again.",
    network_error:                    "Can't reach the server. Check your internet connection.",
    oauth_callback_error:             "Something went wrong with social sign-in. Please try again.",
    oauth_access_denied:              "Sign-in was cancelled.",
    verification_expired:             "The verification link has expired. Please request a new one.",
    verification_failed:              "Verification failed. Please try again.",
    user_locked:                      "This account has been temporarily locked. Please try again later.",
};

// Map of known Supabase / generic error strings → friendly messages
const STRING_ERRORS: { match: string; message: string }[] = [
    { match: 'duplicate key',        message: "That username or email is already taken." },
    { match: 'unique constraint',    message: "That username or email is already taken." },
    { match: 'JWT expired',          message: "Your session expired. Please log in again." },
    { match: 'not authenticated',    message: "You need to be logged in to do that." },
    { match: 'network request failed', message: "No internet connection. Check your network and try again." },
    { match: 'failed to fetch',      message: "Couldn't reach the server. Check your internet connection." },
    { match: 'timeout',              message: "The request took too long. Please try again." },
    { match: 'permission denied',    message: "You don't have permission to do that." },
];

/**
 * Returns a friendly, non-technical error message from any error shape.
 * Falls back to a generic message if nothing matches.
 */
export function getFriendlyError(error: unknown): string {
    if (!error) return "Something went wrong. Please try again.";

    // Clerk error array (e.g. err.errors[0].code)
    if (typeof error === 'object' && error !== null) {
        const e = error as any;

        if (Array.isArray(e.errors) && e.errors.length > 0) {
            const code: string = e.errors[0]?.code || '';
            const msg: string  = e.errors[0]?.message || '';
            if (CLERK_ERRORS[code]) return CLERK_ERRORS[code];
            // Fall through to string matching on the message text
            return matchStringError(msg) || capitalizeFirst(msg) || "Something went wrong. Please try again.";
        }

        // Plain Error or object with .message
        const msg: string = e.message || e.msg || e.error || '';
        if (msg) {
            return matchStringError(msg) || capitalizeFirst(msg) || "Something went wrong. Please try again.";
        }
    }

    if (typeof error === 'string') {
        return matchStringError(error) || capitalizeFirst(error) || "Something went wrong. Please try again.";
    }

    return "Something went wrong. Please try again.";
}

function matchStringError(str: string): string | null {
    const lower = str.toLowerCase();
    for (const entry of STRING_ERRORS) {
        if (lower.includes(entry.match)) return entry.message;
    }
    return null;
}

function capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
