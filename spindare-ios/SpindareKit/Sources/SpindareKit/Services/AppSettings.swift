import Foundation

/// Shared `@AppStorage` keys for the settings that actually drive behavior
/// elsewhere in the app. Centralised so the Settings screen (the writer) and the
/// views that read them (SpeedyCard, Zone, the wheel) can't drift on a string
/// literal. Defaults are documented next to each — a fresh install reads the
/// same value UserDefaults returns for a missing key (false / 0), so any setting
/// whose "off" default isn't false is read with an explicit default at the site.
public enum AppSettingsKey {
    /// Hide the reaction tallies on your own Speedys / posts. Default off.
    public static let hideReactionCounts = "hideReactionCounts"
    /// Seconds you have to change a Speedy reaction. Default 2 (read with default).
    public static let speedyReactionWindow = "speedyReactionWindow"
    /// Show the category lines on the dial before spinning. Default on
    /// (read with an explicit `true` default).
    public static let showDialLines = "showDialLines"
    /// Hide physically-intense sponsors (gyms, parks) on the Zone map. Default off.
    public static let zoneHideIntenseVenues = "zoneHideIntenseVenues"
    /// Only friends may send you a SPIND challenge. Default off (everyone).
    public static let challengeSourceFriendsOnly = "challengeSourceFriendsOnly"
    /// Only friends may DM/call you. Default off (anyone).
    public static let dmSourceFriendsOnly = "dmSourceFriendsOnly"
    /// Opt out of internal usage analytics. Default off.
    public static let dataTrackingOptOut = "dataTrackingOptOut"
    /// Periodic "look away" nudges while watching Speedys. Default off.
    public static let lookAwayNudges = "lookAwayNudges"
    /// Daily reminder to record your own Speedy. Default off.
    public static let dailyRecordReminder = "dailyRecordReminder"
    /// Your profile is private (connections must be approved). Default off (open).
    public static let privacyPrivate = "privacyPrivate"
}
