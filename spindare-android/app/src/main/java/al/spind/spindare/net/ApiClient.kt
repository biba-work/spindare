package al.spind.spindare.net

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * The JSON reader for every API response.
 *
 * `ignoreUnknownKeys` matters more than usual here: the Nest API returns whole
 * Prisma rows, so it sends fields the client has deliberately not modelled
 * (`pushToken` being the one we specifically don't want). Without it, every
 * response would fail to decode.
 */
val SpindareJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    isLenient = true
}

/**
 * Attaches the current Clerk session token to every outgoing request.
 *
 * Fetched per-request rather than cached at construction, matching the fix
 * already made in the iOS `APIClient`: a token cached at sign-in goes stale
 * after an hour and every call starts 401-ing until the app restarts. Clerk's
 * `getToken()` returns the cached one until it is close to expiry, so this is
 * cheap in the common case.
 *
 * OkHttp interceptors are blocking by contract, hence `runBlocking` — it runs on
 * OkHttp's own dispatcher thread, never the main thread.
 */
class ClerkAuthInterceptor(
    private val tokenProvider: suspend () -> String?,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { runCatching { tokenProvider() }.getOrNull() }
        val request = chain.request().newBuilder()
            .apply { if (!token.isNullOrEmpty()) header("Authorization", "Bearer $token") }
            .build()
        return chain.proceed(request)
    }
}

object ApiClient {
    /**
     * @param baseUrl the deployed Nest API root. A trailing slash is required by
     *   Retrofit; it is added here so callers can pass the bare URL.
     */
    fun create(
        baseUrl: String,
        debug: Boolean,
        tokenProvider: suspend () -> String?,
    ): SpindareApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(ClerkAuthInterceptor(tokenProvider))
            .apply {
                if (debug) {
                    addInterceptor(
                        HttpLoggingInterceptor().apply {
                            // BASIC, not BODY: response bodies carry session
                            // tokens and email addresses, and logcat is readable
                            // by anything with adb access.
                            level = HttpLoggingInterceptor.Level.BASIC
                        },
                    )
                }
            }
            // Media uploads go straight to R2 via a presigned PUT, so these
            // timeouts only ever cover small JSON round-trips.
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(SpindareJson.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(SpindareApi::class.java)
    }
}
