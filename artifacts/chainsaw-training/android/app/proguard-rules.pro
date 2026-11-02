# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep enough metadata to retrace Play Console crash reports while still
# allowing class, method and source-file names to be obfuscated.
-keepattributes SourceFile,LineNumberTable,*Annotation*
-renamesourcefileattribute SourceFile

# Capacitor supplies consumer rules for its bridge and plugin annotations.
# Keep the app's explicitly registered native PDF plugin as an additional
# safeguard because JavaScript invokes its methods through the bridge.
-keep class com.chainsawcourses.app.PdfSaverPlugin { *; }
