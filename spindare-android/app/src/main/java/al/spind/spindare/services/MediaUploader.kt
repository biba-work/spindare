package al.spind.spindare.services

import al.spind.spindare.net.PresignBody
import al.spind.spindare.net.SpindareApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.UUID

/**
 * Uploads post/profile media to R2.
 *
 * Ported from SpindareKit/Services/MediaUploader.swift.
 * Everything goes the same way: POST /storage/presign for a short-lived
 * signed URL, then the raw bytes are PUT straight to R2, never through Nest.
 */
class MediaUploader(
    private val api: SpindareApi,
    private val okHttpClient: OkHttpClient = OkHttpClient()
) {

    sealed class UploadError(message: String) : Exception(message) {
        object BadPresignedURL : UploadError("Malformed presigned URL")
        data class PutFailed(val status: Int) : UploadError("R2 upload failed with status $status")
    }

    /** Uploads in-memory bytes and returns the public R2 URL. */
    suspend fun uploadData(data: ByteArray, contentType: String, folder: String): String =
        presignAndPut(
            data,
            contentType,
            folder,
            filename = "${UUID.randomUUID()}${fileExtension(contentType)}"
        )

    /** Uploads a file from disk and returns the public R2 URL. */
    suspend fun uploadFile(file: File, contentType: String, folder: String): String =
        uploadData(file.readBytes(), contentType, folder)

    private suspend fun presignAndPut(
        data: ByteArray,
        contentType: String,
        folder: String,
        filename: String
    ): String = withContext(Dispatchers.IO) {
        val presign = api.presign(PresignBody(contentType, folder, filename))

        val request = Request.Builder()
            .url(presign.uploadUrl)
            .put(data.toRequestBody(contentType.toMediaType()))
            .header("Content-Type", contentType)
            .build()

        okHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw UploadError.PutFailed(response.code)
            }
            presign.publicUrl
        }
    }

    private fun fileExtension(contentType: String): String =
        when (contentType.lowercase()) {
            "image/jpeg", "image/jpg" -> ".jpg"
            "image/png" -> ".png"
            "image/heic" -> ".heic"
            "video/mp4" -> ".mp4"
            "video/quicktime" -> ".mov"
            "audio/m4a", "audio/mp4", "audio/x-m4a" -> ".m4a"
            else -> ""
        }
}

/** Stub uploader for mock mode. Returns a reliable Unsplash placeholder. */
class MockMediaUploader : (ByteArray, String, String) -> String {
    override fun invoke(data: ByteArray, contentType: String, folder: String): String =
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=900"
}
