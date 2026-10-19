package com.aicompanionmobile

import android.os.Build
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.uimanager.ViewManager

/**
 * Tells JavaScript the installed app's real version (versionName / versionCode from the build), so the
 * "minimum app version" check and the version shown in Profile match what Play installed.
 */
class AppVersionModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AppVersion"

  override fun getConstants(): Map<String, Any> {
    val info = reactApplicationContext.packageManager.getPackageInfo(reactApplicationContext.packageName, 0)
    val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    return mapOf("versionName" to (info.versionName ?: ""), "versionCode" to code.toDouble())
  }
}

class AppVersionPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AppVersionModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
