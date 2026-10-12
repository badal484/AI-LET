# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Room finds each database's generated "<Name>_Impl" class by name, so R8 must not rename or drop them.
# WorkManager (used by Notifee) has one: without this the release app crashes at launch.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class **_Impl { *; }
-keep class androidx.work.impl.WorkDatabase { *; }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-dontwarn androidx.room.paging.**

# Notifee and Firebase messaging are started by name from the manifest and from native code.
-keep class io.invertase.notifee.** { *; }
-keep class app.notifee.** { *; }
-keep class io.invertase.firebase.** { *; }
