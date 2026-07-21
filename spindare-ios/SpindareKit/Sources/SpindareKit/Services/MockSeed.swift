import Foundation

// Seed content for MockBackend. Mirrors src/services/MockData.ts in the RN
// client so both apps show the same demo feed while the backend is unverified.

public enum MockSeed {
    public struct SeedUser: Sendable {
        public let id: String
        public let username: String
        public let avatar: String
    }

    private static func hoursAgo(_ hours: Double) -> Date {
        Date().addingTimeInterval(-hours * 3600)
    }

    private static func daysAgo(_ days: Double) -> Date {
        hoursAgo(days * 24)
    }

    public static let users: [SeedUser] = [
        SeedUser(id: "mock-user-1", username: "elia.v", avatar: "https://i.pravatar.cc/150?img=1"),
        SeedUser(id: "mock-user-2", username: "marek.r", avatar: "https://i.pravatar.cc/150?img=5"),
        SeedUser(id: "mock-user-3", username: "sofi.k", avatar: "https://i.pravatar.cc/150?img=9"),
        SeedUser(id: "mock-user-4", username: "dan.exe", avatar: "https://i.pravatar.cc/150?img=12"),
        SeedUser(id: "mock-user-5", username: "lena.w", avatar: "https://i.pravatar.cc/150?img=20"),
        SeedUser(id: "mock-user-6", username: "b.ramos", avatar: "https://i.pravatar.cc/150?img=33"),
        SeedUser(id: "mock-user-7", username: "theo.n", avatar: "https://i.pravatar.cc/150?img=41"),
        SeedUser(id: "mock-user-8", username: "mia.sol", avatar: "https://i.pravatar.cc/150?img=47"),
        SeedUser(id: "mock-user-9", username: "kai.ro", avatar: "https://i.pravatar.cc/150?img=53"),
        SeedUser(id: "mock-user-10", username: "yuki.m", avatar: "https://i.pravatar.cc/150?img=60"),
    ]

    public static var posts: [Post] {
        [
            Post(
                id: "mock-post-1", userId: users[0].id, author: users[0].username, avatar: users[0].avatar,
                challenge: "Silence Protocol",
                content: "Spent 2 hours in total silence. The city sounds like a different beast when you stop contributing to the noise.",
                media: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80",
                spinCount: 1240, reactions: Reactions(felt: 24, thought: 12, intrigued: 5),
                createdAt: hoursAgo(1)
            ),
            Post(
                id: "mock-post-2", userId: users[1].id, author: users[1].username, avatar: users[1].avatar,
                challenge: "Trace a shadow",
                content: "Found the most perfect shadow at 4pm. Traced it with chalk on my floor. By 5pm it was gone. Impermanence, I guess.",
                media: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
                spinCount: 876, reactions: Reactions(felt: 31, thought: 18, intrigued: 9),
                createdAt: hoursAgo(3)
            ),
            Post(
                id: "mock-post-3", userId: MockBackend.currentUserSentinel, author: "you",
                challenge: "One texture, ten seconds",
                content: "Pressed my palm flat against the bark of an oak for ten full seconds. Felt every ridge.",
                media: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&q=80",
                spinCount: 2103, reactions: Reactions(felt: 67, thought: 14, intrigued: 22),
                createdAt: hoursAgo(5)
            ),
            Post(
                id: "mock-post-4", userId: users[3].id, author: users[3].username, avatar: users[3].avatar,
                challenge: "No mirror day",
                content: "Went the whole day without checking how I looked. By lunchtime I stopped caring. By evening I felt weirdly free.",
                spinCount: 3312, reactions: Reactions(felt: 88, thought: 41, intrigued: 17),
                createdAt: hoursAgo(8)
            ),
            Post(
                id: "mock-post-5", userId: users[4].id, author: users[4].username, avatar: users[4].avatar,
                challenge: "Sky for 60 seconds",
                content: "Lay flat on the pavement and stared up for exactly 60 seconds. A woman asked if I needed help. We talked for half an hour.",
                media: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                spinCount: 4018, reactions: Reactions(felt: 112, thought: 34, intrigued: 56),
                createdAt: hoursAgo(14)
            ),
            Post(
                id: "mock-post-6", userId: users[5].id, author: users[5].username, avatar: users[5].avatar,
                challenge: "Write a letter you'll never send",
                content: "Wrote three pages. Tore them up. Then wrote three more. Writing is different when you know no one will read it.",
                spinCount: 1589, reactions: Reactions(felt: 99, thought: 77, intrigued: 11),
                createdAt: daysAgo(1)
            ),
            Post(
                id: "mock-post-7", userId: MockBackend.currentUserSentinel, author: "you",
                challenge: "Eat in silence, no phone",
                content: "Ate breakfast with zero distractions. Actually tasted my food. Wild concept.",
                media: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
                spinCount: 720, reactions: Reactions(felt: 45, thought: 29, intrigued: 8),
                createdAt: daysAgo(1.5)
            ),
            Post(
                id: "mock-post-8", userId: users[7].id, author: users[7].username, avatar: users[7].avatar,
                challenge: "Photograph something broken",
                content: "Found a cracked pavement tile that looked like a map of somewhere I've never been.",
                media: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
                spinCount: 945, reactions: Reactions(felt: 58, thought: 62, intrigued: 33),
                createdAt: daysAgo(2)
            ),
            Post(
                id: "mock-post-9", userId: users[8].id, author: users[8].username, avatar: users[8].avatar,
                challenge: "Compliment a stranger",
                content: "Told the barista her handwriting on the cup was beautiful. She lit up. Made both our days for basically nothing.",
                media: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&q=80",
                spinCount: 5210, reactions: Reactions(felt: 140, thought: 22, intrigued: 19),
                createdAt: daysAgo(2.4)
            ),
            Post(
                id: "mock-post-10", userId: users[9].id, author: users[9].username, avatar: users[9].avatar,
                challenge: "Draw with only circles",
                content: "Tried to draw my dog using nothing but circles. It looks more like a cloud with legs. Will frame it anyway.",
                media: "https://images.unsplash.com/photo-1547407139-3c921a71905c?w=800&q=80",
                spinCount: 1102, reactions: Reactions(felt: 73, thought: 9, intrigued: 41),
                createdAt: daysAgo(3)
            ),
            Post(
                id: "mock-post-11", userId: users[2].id, author: users[2].username, avatar: users[2].avatar,
                challenge: "Walk without your phone",
                content: "10 minutes felt like an hour. Noticed three cats, a mural I'd never seen, and how loud my own thoughts are.",
                spinCount: 630, reactions: Reactions(felt: 52, thought: 48, intrigued: 6),
                createdAt: daysAgo(4)
            ),
            Post(
                id: "mock-post-12", userId: MockBackend.currentUserSentinel, author: "you",
                challenge: "Touch 5 textures in 5 minutes",
                content: "Bark, cold glass, a wool sweater, running water, and my own hair. Weirdly grounding.",
                media: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&q=80",
                spinCount: 480, reactions: Reactions(felt: 36, thought: 15, intrigued: 27),
                createdAt: daysAgo(5)
            ),
            Post(
                id: "mock-post-13", userId: users[6].id, author: users[6].username, avatar: users[6].avatar,
                challenge: "Cook something you have never tried",
                content: "Made pierogi from scratch. Half fell apart in the pot. Ate them anyway with too much butter.",
                media: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
                spinCount: 990, reactions: Reactions(felt: 64, thought: 20, intrigued: 12),
                createdAt: daysAgo(6)
            ),

            // The next 17 exist for `FeedRanking` to have something to work
            // with — spread deliberately across the recency/engagement grid
            // rather than clustered, so a ranking bug (recency swamping
            // engagement, or the reverse) actually shows up when the feed
            // loads instead of being invisible against 13 posts that were all
            // roughly "recent and well-liked."
            Post(
                id: "mock-post-14", userId: users[0].id, author: users[0].username, avatar: users[0].avatar,
                challenge: "Photograph something that reminds you of silence",
                content: "Just posted, barely any reactions yet — the newest thing in the feed.",
                media: "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80",
                spinCount: 12, reactions: Reactions(felt: 1, thought: 0, intrigued: 0),
                createdAt: hoursAgo(1.0 / 12)
            ),
            Post(
                id: "mock-post-15", userId: users[3].id, author: users[3].username, avatar: users[3].avatar,
                challenge: "Give away something you love",
                content: "Gave my favourite jacket to someone sleeping outside the station. Cold walk home, worth it.",
                media: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
                spinCount: 340, reactions: Reactions(felt: 19, thought: 4, intrigued: 2),
                createdAt: hoursAgo(1.0 / 3)
            ),
            // The breakout post — young, already loud. If recency and
            // engagement are both pulling the same direction this should sit
            // at or near the very top.
            Post(
                id: "mock-post-16", userId: users[5].id, author: users[5].username, avatar: users[5].avatar,
                challenge: "Do something you'd never post about",
                content: "Sang karaoke alone in my car in a parking garage. A stranger clapped through the window. I have never been more embarrassed or more alive.",
                media: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
                spinCount: 8840, reactions: Reactions(felt: 310, thought: 88, intrigued: 145),
                createdAt: hoursAgo(0.75)
            ),
            Post(
                id: "mock-post-17", userId: users[8].id, author: users[8].username, avatar: users[8].avatar,
                challenge: "Sit somewhere new for lunch",
                content: "Ate on the library steps instead of my desk. Watched pigeons negotiate over a dropped sandwich.",
                spinCount: 88, reactions: Reactions(felt: 6, thought: 1, intrigued: 0),
                createdAt: hoursAgo(2)
            ),
            Post(
                id: "mock-post-18", userId: users[2].id, author: users[2].username, avatar: users[2].avatar,
                challenge: "Write down a fear and burn it",
                content: "Burned it in the kitchen sink. Set off the smoke alarm. Still felt lighter.",
                media: "https://images.unsplash.com/photo-1475503572774-15a45e5d60b9?w=800&q=80",
                spinCount: 610, reactions: Reactions(felt: 42, thought: 37, intrigued: 8),
                createdAt: hoursAgo(4)
            ),
            // Old-ish but still the loudest thing in the feed — tests whether
            // engagement can outrank several fresher, quieter posts.
            Post(
                id: "mock-post-19", userId: users[9].id, author: users[9].username, avatar: users[9].avatar,
                challenge: "Ask for help with something small",
                content: "Asked a neighbour to help carry a couch up two flights. We've said maybe ten words to each other in three years. Now we wave.",
                media: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80",
                spinCount: 6120, reactions: Reactions(felt: 245, thought: 130, intrigued: 61),
                createdAt: hoursAgo(7)
            ),
            Post(
                id: "mock-post-20", userId: users[4].id, author: users[4].username, avatar: users[4].avatar,
                challenge: "Sit in the dark for ten minutes",
                content: "No phone, no lights, just the fridge humming. Longest ten minutes of the week.",
                spinCount: 154, reactions: Reactions(felt: 11, thought: 9, intrigued: 3),
                createdAt: hoursAgo(10)
            ),
            Post(
                id: "mock-post-21", userId: users[7].id, author: users[7].username, avatar: users[7].avatar,
                challenge: "Learn one word in a new language",
                content: "Learned 'komorebi' — Japanese for sunlight filtering through leaves. Now I see it everywhere.",
                media: "https://images.unsplash.com/photo-1476231682828-37e571bc172f?w=800&q=80",
                spinCount: 1830, reactions: Reactions(felt: 96, thought: 71, intrigued: 40),
                createdAt: hoursAgo(12)
            ),
            Post(
                id: "mock-post-22", userId: MockBackend.currentUserSentinel, author: "you",
                challenge: "Text someone you've been meaning to",
                content: "Finally messaged a friend I lost touch with two years ago. Three-hour reply. Worth every awkward second before sending it.",
                media: "https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800&q=80",
                spinCount: 720, reactions: Reactions(felt: 58, thought: 22, intrigued: 6),
                createdAt: hoursAgo(18)
            ),
            Post(
                id: "mock-post-23", userId: users[1].id, author: users[1].username, avatar: users[1].avatar,
                challenge: "Make something with your hands",
                content: "Whittled a very lopsided spoon. It scoops nothing correctly. It's my favourite object I own now.",
                media: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&q=80",
                spinCount: 2440, reactions: Reactions(felt: 140, thought: 55, intrigued: 30),
                createdAt: daysAgo(1)
            ),
            // Old and quiet — the algorithm should sink this well below the
            // fresher posts above it, not just below the loud ones.
            Post(
                id: "mock-post-24", userId: users[6].id, author: users[6].username, avatar: users[6].avatar,
                challenge: "Skip music for a whole commute",
                content: "Just the train noise. Noticed how tired everyone looked. Then noticed I probably looked the same.",
                spinCount: 40, reactions: Reactions(felt: 3, thought: 1, intrigued: 0),
                createdAt: daysAgo(1.2)
            ),
            // Old but still the biggest post in the whole seed — the
            // clearest test of whether engagement can drag an old post back
            // toward the top at all, or whether decay just buries it.
            Post(
                id: "mock-post-25", userId: users[3].id, author: users[3].username, avatar: users[3].avatar,
                challenge: "Tell someone what they mean to you",
                content: "Told my grandmother, in person, exactly what her Sunday calls have meant every week since I moved. We both cried. Worth the whole app existing for this one.",
                media: "https://images.unsplash.com/photo-1495001258031-d1b407bc1776?w=800&q=80",
                spinCount: 15200, reactions: Reactions(felt: 512, thought: 340, intrigued: 190),
                createdAt: daysAgo(2)
            ),
            Post(
                id: "mock-post-26", userId: users[8].id, author: users[8].username, avatar: users[8].avatar,
                challenge: "Notice five colours you'd normally miss",
                content: "Rust on a fire escape, a green I've never seen on a bus, someone's yellow umbrella held wrong.",
                spinCount: 95, reactions: Reactions(felt: 7, thought: 2, intrigued: 1),
                createdAt: daysAgo(2.5)
            ),
            Post(
                id: "mock-post-27", userId: users[0].id, author: users[0].username, avatar: users[0].avatar,
                challenge: "Sit with boredom instead of your phone",
                content: "Twenty minutes on a bench doing genuinely nothing. Physically uncomfortable at first, then not.",
                media: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=800&q=80",
                spinCount: 980, reactions: Reactions(felt: 61, thought: 48, intrigued: 15),
                createdAt: daysAgo(3)
            ),
            Post(
                id: "mock-post-28", userId: users[5].id, author: users[5].username, avatar: users[5].avatar,
                challenge: "Say no to something you'd normally agree to",
                content: "Turned down a plan I didn't want to go to. No excuse, just 'I don't want to.' Felt illegal.",
                spinCount: 210, reactions: Reactions(felt: 14, thought: 6, intrigued: 2),
                createdAt: daysAgo(4)
            ),
            // Old, but the kind of post that keeps getting found — the
            // long-tail "evergreen" case: engagement high enough to still
            // matter well after the recency window everything else lives in.
            Post(
                id: "mock-post-29", userId: users[9].id, author: users[9].username, avatar: users[9].avatar,
                challenge: "Do the thing you've been putting off for a year",
                content: "Finally called about the thing I'd been avoiding for eleven months. Took four minutes. Eleven months.",
                media: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
                spinCount: 4300, reactions: Reactions(felt: 210, thought: 165, intrigued: 70),
                createdAt: daysAgo(4)
            ),
            // Oldest and quietest in the seed — the floor of the feed.
            Post(
                id: "mock-post-30", userId: users[2].id, author: users[2].username, avatar: users[2].avatar,
                challenge: "Watch the sunset without photographing it",
                content: "Left my phone inside. The sky did something orange and enormous. No proof it happened except this sentence.",
                spinCount: 22, reactions: Reactions(felt: 2, thought: 0, intrigued: 0),
                createdAt: daysAgo(7)
            ),
        ]
    }

    public static var notifications: [AppNotification] {
        [
            AppNotification(
                id: "mock-notif-1", type: .reaction, fromUserId: users[4].id,
                fromUsername: users[4].username, fromAvatar: users[4].avatar,
                content: "felt your \"One texture, ten seconds\" post",
                targetId: "mock-post-3", read: false, createdAt: hoursAgo(0.5)
            ),
            AppNotification(
                id: "mock-notif-2", type: .comment, fromUserId: users[8].id,
                fromUsername: users[8].username, fromAvatar: users[8].avatar,
                content: "commented on your \"Eat in silence\" post",
                targetId: "mock-post-7", read: false, createdAt: hoursAgo(2)
            ),
            AppNotification(
                id: "mock-notif-3", type: .challenge, fromUserId: users[1].id,
                fromUsername: users[1].username, fromAvatar: users[1].avatar,
                content: "sent you a challenge: \"Draw how you feel using only circles\"",
                read: false, createdAt: hoursAgo(6)
            ),
            AppNotification(
                id: "mock-notif-4", type: .reaction, fromUserId: users[7].id,
                fromUsername: users[7].username, fromAvatar: users[7].avatar,
                content: "was intrigued by your \"Touch 5 textures\" post",
                targetId: "mock-post-12", read: true, createdAt: daysAgo(1)
            ),
            AppNotification(
                id: "mock-notif-5", type: .follow, fromUserId: users[5].id,
                fromUsername: users[5].username, fromAvatar: users[5].avatar,
                content: "started following you", read: true, createdAt: daysAgo(2)
            ),
        ]
    }

    public static var requests: [ConnectionRequest] {
        [ConnectionRequest(id: users[9].id, username: users[9].username, photoURL: users[9].avatar)]
    }

    public static var saved: [SavedChallenge] {
        [
            SavedChallenge(challenge: "Draw how you feel using only circles.",
                           expiresAt: Date().addingTimeInterval(20 * 3600)),
            SavedChallenge(challenge: "Ask a stranger what their favourite memory is.",
                           expiresAt: Date().addingTimeInterval(44 * 3600)),
        ]
    }

    /// The SPIND inbox — challenges other people sent you.
    ///
    /// One already accepted, so the two-stage flow (decide, then do) is visible
    /// without having to accept something first.
    public static var spind: [SpindChallenge] {
        [
            SpindChallenge(
                id: "spind-1",
                challenge: "Photograph something that reminds you of silence.",
                fromUserId: users[2].id,
                fromUsername: users[2].username,
                fromAvatar: users[2].avatar,
                sentAt: Date().addingTimeInterval(-2 * 3600),
                expiresAt: Date().addingTimeInterval(22 * 3600)
            ),
            SpindChallenge(
                id: "spind-2",
                challenge: "Ask a stranger what their favourite memory is.",
                fromUserId: users[5].id,
                fromUsername: users[5].username,
                fromAvatar: users[5].avatar,
                sentAt: Date().addingTimeInterval(-9 * 3600),
                // Under six hours, so the countdown renders in its urgent state.
                expiresAt: Date().addingTimeInterval(4 * 3600)
            ),
            SpindChallenge(
                id: "spind-3",
                challenge: "Walk 10 minutes without looking at any screen.",
                fromUserId: users[1].id,
                fromUsername: users[1].username,
                fromAvatar: users[1].avatar,
                sentAt: Date().addingTimeInterval(-26 * 3600),
                expiresAt: Date().addingTimeInterval(15 * 3600),
                accepted: true
            ),
        ]
    }

    public static var friends: [Friend] {
        users.prefix(6).map {
            Friend(id: $0.id, name: $0.username, username: $0.username, photoURL: $0.avatar)
        }
    }

    /// The message list. Deliberately spread across hours and days rather than
    /// all seeded "now" — a list where every thread shares a timestamp can't
    /// demonstrate that it's sorted, and can't show the relative-time labels
    /// doing anything either.
    // MARK: - Zone
    //
    // Centred on Tirana, matching where this app's first users actually are.
    // Coordinates are real places' rough positions so the map reads as a real
    // neighbourhood rather than pins scattered on water.

    public static let zoneCenter = (latitude: 41.3275, longitude: 19.8187)

    public static var venues: [Venue] {
        [
            Venue(
                id: "venue-1", name: "Iron Yard", category: .gym,
                latitude: 41.3301, longitude: 19.8225,
                blurb: "Open 24h. Free day pass for anyone completing the challenge.",
                sponsoredChallenge: "Do 20 push-ups somewhere you'd normally feel watched."
            ),
            Venue(
                id: "venue-2", name: "Mulliri i Vjetër", category: .cafe,
                latitude: 41.3258, longitude: 19.8151,
                blurb: "Corner table by the window. Ask for the quiet seat.",
                sponsoredChallenge: "Drink a coffee with no phone, no book, no music."
            ),
            Venue(
                id: "venue-3", name: "Grand Park", category: .park,
                latitude: 41.3169, longitude: 19.8218,
                blurb: "The lake loop is 2.4km.",
                sponsoredChallenge: "Walk the lake loop without checking the time once."
            ),
            Venue(
                id: "venue-4", name: "Studio Bardhë", category: .studio,
                latitude: 41.3312, longitude: 19.8142,
                blurb: "Ceramics and print. Walk-ins on Thursdays.",
                sponsoredChallenge: "Make something with your hands and give it away same day."
            ),
            Venue(
                id: "venue-5", name: "Komiteti", category: .cafe,
                latitude: 41.3243, longitude: 19.8239,
                blurb: "Raki and old furniture. Loud on purpose.",
                sponsoredChallenge: "Ask a stranger here what their favourite memory is."
            ),
            Venue(
                id: "venue-6", name: "Reload Bookshop", category: .shop,
                latitude: 41.3288, longitude: 19.8196,
                blurb: "Second-hand, mostly Albanian and Italian.",
                sponsoredChallenge: "Buy a book you'd never pick, read the first chapter here."
            ),
            Venue(
                id: "venue-7", name: "Anima Climbing", category: .gym,
                latitude: 41.3335, longitude: 19.8261,
                blurb: "Bouldering only. Shoes included with a day pass.",
                // No live campaign — on the map, no challenge attached.
                sponsoredChallenge: nil
            ),
        ]
    }

    /// Completed sponsored challenges, one or more per venue, chosen to exercise
    /// every rule the Zone pins follow: your own shows instantly; a stranger's
    /// old post shows to all; a stranger's fresh post stays withheld (the pin
    /// falls back to the venue glyph); and where a venue has several, the
    /// most-reacted one wins the pin.
    public static var venuePosts: [VenuePost] {
        [
            // Yours — visible to you the moment you post, gate or no gate.
            VenuePost(
                id: "vp-1", venueId: "venue-1", userId: MockBackend.currentUserSentinel,
                author: "you",
                media: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
                reactions: Reactions(felt: 4, thought: 2, intrigued: 1), createdAt: hoursAgo(0.03)
            ),
            // A stranger's, well past the five minutes and heavily reacted — everyone sees it.
            VenuePost(
                id: "vp-2", venueId: "venue-2", userId: users[1].id, author: users[1].username, avatar: users[1].avatar,
                media: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
                reactions: Reactions(felt: 40, thought: 22, intrigued: 9), createdAt: hoursAgo(3)
            ),
            // A stranger's, posted a minute ago — withheld; the pin shows the venue glyph.
            VenuePost(
                id: "vp-3", venueId: "venue-3", userId: users[4].id, author: users[4].username, avatar: users[4].avatar,
                media: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80",
                reactions: Reactions(felt: 2, thought: 1, intrigued: 0), createdAt: hoursAgo(0.017)
            ),
            // Two at one venue, both old — the most-reacted wins the pin.
            VenuePost(
                id: "vp-4", venueId: "venue-5", userId: users[5].id, author: users[5].username, avatar: users[5].avatar,
                media: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&q=80",
                reactions: Reactions(felt: 12, thought: 30, intrigued: 6), createdAt: hoursAgo(5)
            ),
            VenuePost(
                id: "vp-5", venueId: "venue-5", userId: users[8].id, author: users[8].username, avatar: users[8].avatar,
                media: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80",
                reactions: Reactions(felt: 3, thought: 2, intrigued: 1), createdAt: hoursAgo(4)
            ),
        ]
    }

    static var sponsors: [String: Sponsor] {
        Dictionary(uniqueKeysWithValues: venues.map { venue in
            (venue.id, Sponsor(id: "sponsor-\(venue.id)", name: venue.name, venueId: venue.id))
        })
    }

    // MARK: - Speedys
    //
    // Ten cards. Video URLs are Google's long-standing public test bucket —
    // real remote MP4s, so playback, buffering and the poster-while-loading
    // path are all genuinely exercised rather than faked with a still. The
    // clips' *content* is obviously not someone doing a challenge; swapping in
    // real footage is a URL change, nothing structural.
    //
    // Two of the ten are photo-only (`videoURL: nil`) on purpose, because that
    // path has to work too — not every proof is a video.
    //
    // Three are sponsored, and two of those are seeded *inside* the five
    // minute window, so the delay in `SponsoredVisibility` is visible the
    // moment you open the tab instead of only in tests.

    // Only the short (~30-60s, low-tens-of-MB) ad-style clips from Google's
    // public test bucket. The previous version of this list also included
    // ElephantsDream.mp4, Sintel.mp4, and TearsOfSteel.mp4 — those are the
    // *entire* animated short films the bucket is named after, 10-15 minutes
    // and 50-130MB each. Scrolling to whichever Speedy used one of those
    // tried to load a feature-length file for something that's supposed to
    // be a quick clip, which is exactly the kind of thing that produces
    // severe, inconsistent lag tied to a specific card rather than the
    // feature as a whole. Five URLs cycling across ten seed items is a
    // deliberate trade — repetition over risking another oversized file.
    private static let sampleVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    ]

    public static var speedys: [Speedy] {
        let sponsorFor = sponsors

        return [
            Speedy(
                id: "speedy-1", userId: users[0].id, author: users[0].username, avatar: users[0].avatar,
                challenge: "Stare at the sky for 60 seconds",
                detail: "Lay flat on the pavement outside my building. Someone asked if I was okay. Now we're friends.",
                videoURL: sampleVideos[0],
                posterURL: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
                reactions: Reactions(felt: 112, thought: 34, intrigued: 56),
                createdAt: hoursAgo(0.4)
            ),
            Speedy(
                id: "speedy-2", userId: users[1].id, author: users[1].username, avatar: users[1].avatar,
                challenge: "Trace a shadow",
                detail: "4pm light, chalk on the floor. By 5 it was gone.",
                videoURL: sampleVideos[1],
                posterURL: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
                reactions: Reactions(felt: 31, thought: 18, intrigued: 9),
                createdAt: hoursAgo(1.2)
            ),
            // Sponsored, still inside the window — hidden from everyone but
            // its author until it ages out. Watch it appear.
            Speedy(
                id: "speedy-3", userId: users[2].id, author: users[2].username, avatar: users[2].avatar,
                challenge: "Do 20 push-ups somewhere you'd normally feel watched",
                detail: "Did them in the middle of the gym floor at peak hour. Nobody looked. Nobody ever looks.",
                videoURL: sampleVideos[2],
                posterURL: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80",
                reactions: Reactions(felt: 64, thought: 12, intrigued: 30),
                createdAt: Date().addingTimeInterval(-90),
                sponsor: sponsorFor["venue-1"]
            ),
            Speedy(
                id: "speedy-4", userId: users[3].id, author: users[3].username, avatar: users[3].avatar,
                challenge: "Eat a meal with zero distractions",
                detail: "No phone, no screen, no music. Tasted my food for the first time in weeks.",
                // Photo-only card.
                posterURL: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
                reactions: Reactions(felt: 45, thought: 29, intrigued: 8),
                createdAt: hoursAgo(3)
            ),
            Speedy(
                id: "speedy-5", userId: users[4].id, author: users[4].username, avatar: users[4].avatar,
                challenge: "Walk 10 minutes without looking at a screen",
                detail: "Noticed three cats and a mural I've walked past for two years.",
                videoURL: sampleVideos[3],
                posterURL: "https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=800&q=80",
                reactions: Reactions(felt: 52, thought: 48, intrigued: 6),
                createdAt: hoursAgo(5)
            ),
            // Sponsored and already past the window — visible to everyone.
            Speedy(
                id: "speedy-6", userId: users[5].id, author: users[5].username, avatar: users[5].avatar,
                challenge: "Drink a coffee with no phone, no book, no music",
                detail: "Twenty minutes at the window table just watching the street. Hardest thing I've done this week.",
                videoURL: sampleVideos[4],
                posterURL: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
                reactions: Reactions(felt: 88, thought: 62, intrigued: 21),
                createdAt: hoursAgo(6),
                sponsor: sponsorFor["venue-2"]
            ),
            Speedy(
                id: "speedy-7", userId: users[6].id, author: users[6].username, avatar: users[6].avatar,
                challenge: "Photograph something nobody else would notice",
                detail: "A cracked tile that looks like a map of somewhere I've never been.",
                // Photo-only card.
                posterURL: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
                reactions: Reactions(felt: 58, thought: 62, intrigued: 33),
                createdAt: hoursAgo(9)
            ),
            Speedy(
                id: "speedy-8", userId: users[7].id, author: users[7].username, avatar: users[7].avatar,
                challenge: "Write a letter you'll never send",
                detail: "Three pages. Tore them up. Wrote three more.",
                videoURL: sampleVideos[0],
                posterURL: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
                reactions: Reactions(felt: 99, thought: 77, intrigued: 11),
                createdAt: hoursAgo(14)
            ),
            // Sponsored, seeded just now — the freshest of the delayed ones.
            Speedy(
                id: "speedy-9", userId: users[8].id, author: users[8].username, avatar: users[8].avatar,
                challenge: "Walk the lake loop without checking the time once",
                detail: "2.4km. No idea how long it took and that was the whole point.",
                videoURL: sampleVideos[1],
                posterURL: "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80",
                reactions: Reactions(felt: 41, thought: 25, intrigued: 18),
                createdAt: Date().addingTimeInterval(-20),
                sponsor: sponsorFor["venue-3"]
            ),
            Speedy(
                id: "speedy-10", userId: users[9].id, author: users[9].username, avatar: users[9].avatar,
                challenge: "Give away something you love",
                detail: "My favourite jacket, to someone sleeping outside the station. Cold walk home.",
                videoURL: sampleVideos[2],
                posterURL: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80",
                reactions: Reactions(felt: 210, thought: 96, intrigued: 44),
                createdAt: daysAgo(1)
            ),
        ]
    }

    public static var conversations: [Conversation] {
        let previews: [(String, TimeInterval, Int)] = [
            ("Don't forget to take a video", -14 * 60, 2),
            ("that one was harder than it looked", -3 * 3600, 0),
            ("ok your turn 😤", -9 * 3600, 1),
            ("sent you one, good luck", -26 * 3600, 0),
            ("hahaha no way you actually did it", -2 * 24 * 3600, 0),
            ("we still on for saturday?", -5 * 24 * 3600, 0),
        ]

        return zip(users.prefix(6), previews).map { user, preview in
            Conversation(
                id: "conv-\(user.id)",
                otherUserId: user.id,
                otherUsername: user.username,
                otherAvatarURL: user.avatar,
                lastMessage: preview.0,
                lastMessageAt: Date().addingTimeInterval(preview.1),
                unreadCount: preview.2
            )
        }
    }

    /// A short opening exchange, generated on first open of any conversation.
    /// `conversationId` is always `"conv-<friendId>"` (see `MessagesView`),
    /// so the other party's id is recovered by stripping that prefix rather
    /// than needing it passed in separately.
    public static func seedMessages(for conversationId: String, currentUserId: String) -> [Message] {
        let otherId = conversationId.hasPrefix("conv-")
            ? String(conversationId.dropFirst("conv-".count))
            : conversationId

        return [
            Message(
                id: "\(conversationId)-seed-1",
                conversationId: conversationId,
                senderId: otherId,
                text: "Hey! Did you do the challenge?",
                sentAt: Date().addingTimeInterval(-2 * 3600)
            ),
            Message(
                id: "\(conversationId)-seed-2",
                conversationId: conversationId,
                senderId: currentUserId,
                text: "Working on it right now!",
                sentAt: Date().addingTimeInterval(-2 * 3600 + 90)
            ),
            Message(
                id: "\(conversationId)-seed-3",
                conversationId: conversationId,
                senderId: otherId,
                text: "Don't forget to take a video",
                sentAt: Date().addingTimeInterval(-2 * 3600 + 240)
            ),
        ]
    }
}
