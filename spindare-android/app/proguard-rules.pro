# kotlinx.serialization keeps its generated serializers via @Serializable, but
# R8 needs the companion/serializer members preserved for reflection-free lookup.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class al.spind.spindare.model.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keepclasseswithmembers class al.spind.spindare.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit interfaces are reflected over at runtime.
-keep,allowobfuscation interface al.spind.spindare.net.SpindareApi
-keepattributes Signature, RuntimeVisibleAnnotations
