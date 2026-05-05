package com.e2e.orionstar.bridge

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.ainirobot.agent.vad.IVadAudioListener
import com.ainirobot.agent.vad.IVadAudioService

class VadBridge(private val context: Context, private val webView: WebView) {

    companion object {
        private const val TAG = "VadBridge"
        private const val BIND_TIMEOUT_MS = 3000L // 绑定超时时间
    }

    private var vadAudioService: IVadAudioService? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isServiceBound = false
    private var isServiceConnected = false  // 实际连接成功的标志

    // 绑定完成回调
    private var onBindResultCallback: ((Boolean) -> Unit)? = null

    // VAD 监听器实现
    private val vadListener = object : IVadAudioListener.Stub() {
        override fun onVadBegin(sid: String?) {
            val safeSid = sid ?: "unknown"
            Log.d(TAG, "onVadBegin: $safeSid")
            sendJsEvent("onVadStart", "'$safeSid'")
        }

        override fun onVadEnd(sid: String?) {
            val safeSid = sid ?: "unknown"
            Log.d(TAG, "onVadEnd: $safeSid")
            sendJsEvent("onVadEnd", "'$safeSid'")
        }

        override fun onAudioData(data: ByteArray?, len: Int) {
            if (data != null && len > 0) {
                // 将 PCM 字节流转换为 Base64 字符串传输给 JS
                val base64Data = Base64.encodeToString(data, 0, len, Base64.NO_WRAP)
                sendJsEvent("onAudioData", "'$base64Data'")
            }
        }

        override fun onFilterVadData(sid: String?, filter: Boolean, speakId: Int, reason: String?) {
            Log.d(TAG, "onFilterVadData: $sid, $filter, $speakId, $reason")
            // 传递 filter 状态给 JS：filter=true 表示被过滤，filter=false 表示有效音频
            sendJsEvent("onFilterVadData", "'$sid', $filter, $speakId, '${reason ?: ""}'")
        }
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.i(TAG, "VAD Service Connected")
            try {
                vadAudioService = IVadAudioService.Stub.asInterface(service)
                vadAudioService?.registerListener(vadListener)
                vadAudioService?.setMicrophoneMuted(false)
                isServiceConnected = true
                // 通知回调绑定成功
                notifyBindResult(true)
                // 通知前端 Bridge 已就绪
                sendJsEvent("onBridgeReady", "")
            } catch (e: Exception) {
                Log.e(TAG, "Error registering listener", e)
                isServiceConnected = false
                notifyBindResult(false)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.w(TAG, "VAD Service Disconnected")
            vadAudioService = null
            isServiceConnected = false
        }
    }

    /**
     * 通知绑定结果（只调用一次）
     */
    private fun notifyBindResult(success: Boolean) {
        handler.post {
            onBindResultCallback?.invoke(success)
            onBindResultCallback = null  // 只调用一次
        }
    }

    /**
     * 初始化：绑定服务
     * @param callback 绑定结果回调，true 表示成功，false 表示失败
     */
    fun initVadService(callback: ((Boolean) -> Unit)? = null) {
        onBindResultCallback = callback

        val intent = Intent("com.ainirobot.agent.vad.VadAudioService")
        intent.setPackage("com.ainirobot.agentservice")
        try {
            isServiceBound = context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            if (!isServiceBound) {
                Log.e(TAG, "Bind VAD service failed")
                notifyBindResult(false)
                return
            }

            // 设置超时，如果超时还没连接成功则回调失败
            handler.postDelayed({
                if (!isServiceConnected && onBindResultCallback != null) {
                    Log.w(TAG, "VAD service bind timeout")
                    notifyBindResult(false)
                }
            }, BIND_TIMEOUT_MS)

        } catch (e: Exception) {
            Log.e(TAG, "Bind VAD exception", e)
            notifyBindResult(false)
        }
    }

    /**
     * 销毁：解绑服务
     */
    fun destroy() {
        // 取消超时回调
        handler.removeCallbacksAndMessages(null)
        onBindResultCallback = null

        // 只要绑定过，就必须解绑，避免 ServiceConnection 泄漏
        if (isServiceBound) {
            try {
                // 只有连接成功时才需要注销监听器
                vadAudioService?.unregisterListener(vadListener)
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering listener", e)
            }
            try {
                context.unbindService(serviceConnection)
            } catch (e: Exception) {
                Log.e(TAG, "Error unbinding service", e)
            }
            isServiceBound = false
            isServiceConnected = false
            vadAudioService = null
        }
    }

    /**
     * 发送事件到 JS
     * 对应前端 window.DeepVBridge.xxx
     */
    private fun sendJsEvent(methodName: String, params: String) {
        handler.post {
            // 检查 window.DeepVBridge 是否存在，避免报错
            val js = "if(window.DeepVBridge && window.DeepVBridge.$methodName) { window.DeepVBridge.$methodName($params); }"
            webView.evaluateJavascript(js, null)
        }
    }

    /**
     * 检查 VAD 服务是否可用
     */
    fun isVadAvailable(): Boolean = isServiceConnected

    /**
     * 设置麦克风静音状态
     * @param muted true 静音，false 取消静音
     */
    fun setMicrophoneMuted(muted: Boolean) {
        try {
            vadAudioService?.setMicrophoneMuted(muted)
            Log.i(TAG, "🎤 麦克风静音状态设置为: $muted")
        } catch (e: Exception) {
            Log.e(TAG, "设置麦克风静音状态失败", e)
        }
    }

    // ================= Javascript Interfaces =================

    /**
     * 前端调用此方法检查 VAD 是否可用
     * @return true 如果 VAD 服务已连接且可用
     */
    @JavascriptInterface
    fun isAvailable(): Boolean {
        return isServiceConnected
    }

    /**
     * 前端调用此方法通知 Android 页面已加载完毕，可以开始初始化 VAD
     * 注意：现在 VAD 服务在 Activity 初始化时就已经绑定，这个方法保留做兼容
     */
    @JavascriptInterface
    fun notifyReady() {
        Log.i(TAG, "Frontend notified ready, VAD available: $isServiceConnected")
        if (isServiceConnected) {
            // 已经连接成功，通知前端
            sendJsEvent("onBridgeReady", "")
        }
        // 如果没连接成功，不发送 onBridgeReady，前端会知道 VAD 不可用
    }

    /**
     * 强制停止 VAD (如果需要)
     */
    @JavascriptInterface
    fun stopVad() {
        // 这里的逻辑取决于底层 Service 是否支持主动停止，
        // 通常 VAD 是被动的，但如果需要，可以在这里添加逻辑
        Log.i(TAG, "Stop VAD requested from JS")
    }
}