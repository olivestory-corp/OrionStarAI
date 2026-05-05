package com.e2e.orionstar

import android.app.Activity
import android.app.Application
import android.content.ComponentCallbacks
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Bundle
import android.util.DisplayMetrics
import android.util.Log

/**
 * 自定义 Application 类
 * 在应用启动时全局设置 DPI
 */
class E2EApplication : Application() {

    companion object {
        private const val TAG = "E2EApplication"

        /** 默认 DPI 值 */
        const val DEFAULT_DPI = 160

        /**
         * 强制设置指定 Resources 的 DPI
         */
        fun setDpi(resources: Resources) {
            try {
                val displayMetrics = resources.displayMetrics
                val density = DEFAULT_DPI / 160f

                displayMetrics.densityDpi = DEFAULT_DPI
                displayMetrics.density = density
                displayMetrics.scaledDensity = density
                displayMetrics.xdpi = DEFAULT_DPI.toFloat()
                displayMetrics.ydpi = DEFAULT_DPI.toFloat()

                val configuration = resources.configuration
                configuration.densityDpi = DEFAULT_DPI

                @Suppress("DEPRECATION")
                resources.updateConfiguration(configuration, displayMetrics)

                Log.d(TAG, "DPI 设置完成: ${displayMetrics.densityDpi}")
            } catch (e: Exception) {
                Log.e(TAG, "设置 DPI 失败", e)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()

        // 设置 DPI
        applyDpi()

        // 注册 Activity 生命周期回调，确保每个 Activity 都应用 DPI
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
                setDpi(activity.resources)
                Log.d(TAG, "Activity ${activity.javaClass.simpleName} DPI 已设置")
            }
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityResumed(activity: Activity) {
                // 每次 resume 时也强制设置
                setDpi(activity.resources)
            }
            override fun onActivityPaused(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })

        // 注册配置变化回调
        registerComponentCallbacks(object : ComponentCallbacks {
            override fun onConfigurationChanged(newConfig: Configuration) {
                applyDpi()
            }
            override fun onLowMemory() {}
        })
    }

    private fun applyDpi() {
        // 设置 Application resources
        setDpi(resources)
        // 设置系统 resources
        setDpi(Resources.getSystem())

        Log.d(TAG, "Application DPI 已应用: ${resources.displayMetrics.densityDpi}")
    }
}
