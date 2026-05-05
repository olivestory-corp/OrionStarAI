package com.e2e.orionstar

import android.Manifest
import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.e2e.orionstar.BuildConfig
import com.e2e.orionstar.base.BaseGestureActivity
import com.e2e.orionstar.bridge.RobotNavigationBridge
import com.e2e.orionstar.bridge.VadBridge

/**
 * 主Activity - 加载WebView并桥接RobotAPI
 */
class MainActivity : BaseGestureActivity() {

    companion object {
        private const val TAG = "MainActivity"

        // 需要的权限
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS,
            Manifest.permission.INTERNET,
            Manifest.permission.ACCESS_NETWORK_STATE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
            Manifest.permission.READ_EXTERNAL_STORAGE
        )
    }

    private lateinit var webView: WebView
    private lateinit var robotBridge: RobotNavigationBridge
    private lateinit var vadBridge: VadBridge

    // 🔊 音量同步相关
    private lateinit var audioManager: AudioManager
    private var volumeReceiver: BroadcastReceiver? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // 权限请求启动器
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.entries.all { it.value }
        if (allGranted) {
            Log.i(TAG, "所有权限已授予")
            initializeWebView()
        } else {
            Log.w(TAG, "部分权限被拒绝")
            // 即使权限被拒绝，也继续初始化WebView（某些功能可能不可用）
            initializeWebView()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 🔊 确保音量键控制媒体音量，WebView 的 AudioContext 也走这个通道
        volumeControlStream = AudioManager.STREAM_MUSIC

        // 🔊 初始化 AudioManager
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // 初始化RobotAPI桥接
        robotBridge = RobotNavigationBridge(this)
        robotBridge.initRobotApi()

        // 请求必要的权限
        requestPermissions()
    }

    override fun onResume() {
        super.onResume()
        // 取消麦克风静音，确保 App 可以正常录音
        if (::vadBridge.isInitialized) {
            vadBridge.setMicrophoneMuted(false)
        }
    }

    /**
     * 🔊 注册音量变化监听器
     */
    private fun registerVolumeReceiver() {
        volumeReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == "android.media.VOLUME_CHANGED_ACTION") {
                    syncVolumeToWebView()
                }
            }
        }
        val filter = IntentFilter("android.media.VOLUME_CHANGED_ACTION")
        registerReceiver(volumeReceiver, filter)
        Log.i(TAG, "🔊 音量监听器已注册")

        // 初始同步一次音量
        syncVolumeToWebView()
    }

    /**
     * 🔊 同步系统音量到 WebView
     */
    private fun syncVolumeToWebView() {
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val normalizedVolume = if (maxVolume > 0) currentVolume.toFloat() / maxVolume else 1f

        Log.d(TAG, "🔊 同步音量到 WebView: $currentVolume/$maxVolume = $normalizedVolume")

        mainHandler.post {
            // 设置初始音量变量（供 AudioPlayer 初始化时读取）+ 调用动态设置接口
            webView.evaluateJavascript(
                """
                window.__androidInitialVolume = $normalizedVolume;
                if(window.__setAudioVolume) { window.__setAudioVolume($normalizedVolume); }
                """.trimIndent(),
                null
            )
        }
    }

    /**
     * 请求必要的权限
     */
    private fun requestPermissions() {
        val permissionsToRequest = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        } else {
            // 所有权限已授予
            initializeWebView()
        }
    }

    /**
     * 初始化WebView
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun initializeWebView() {
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // 设置WebView引用到bridge
        robotBridge.webView = webView

        // 初始化 VadBridge
        vadBridge = VadBridge(this, webView)

        // 配置WebView设置
        configureWebSettings(webView.settings)

        // 设置 WebView 强制缩放 - 通过修改 WebSettings 的默认缩放
        val windowManager = getSystemService(WINDOW_SERVICE) as android.view.WindowManager
        val realMetrics = android.util.DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(realMetrics)
        val realSystemDpi = realMetrics.densityDpi
        val targetDpi = 180

        // 方法1: 设置文字缩放
        val textZoom =  110 //(realSystemDpi.toFloat() / targetDpi * 100).toInt()
        webView.settings.textZoom = textZoom

        // 方法2: 强制设置初始缩放
        webView.setInitialScale(textZoom)

        // 方法3: 设置默认缩放方式为 FAR (放大)
        webView.settings.defaultZoom = WebSettings.ZoomDensity.FAR

        Log.i(TAG, "WebView 缩放设置: textZoom=$textZoom%, initialScale=$textZoom% (系统DPI: $realSystemDpi, 目标DPI: $targetDpi)")

        // 计算缩放比例
        val zoomScale = realSystemDpi.toFloat() / targetDpi

        // 设置WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // 🔊 页面加载完成后同步音量
                mainHandler.postDelayed({ syncVolumeToWebView() }, 500)
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                Log.e(TAG, "页面加载错误: $description")
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: android.webkit.SslErrorHandler?,
                error: android.net.http.SslError?
            ) {
                // 无条件信任SSL证书
                handler?.proceed()
                Log.w(TAG, "SSL证书错误已忽略: ${error?.toString()}")
            }
        }

        // 设置WebChromeClient以支持权限请求和控制台日志
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                // 自动授予WebView请求的权限（摄像头、麦克风等）
                request?.grant(request.resources)
                Log.i(TAG, "WebView权限请求已授予: ${request?.resources?.joinToString()}")
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    // 根据日志级别重定向到Logcat
                    val jsTag = "WebViewJS"
                    val message = "[${it.sourceId()}:${it.lineNumber()}] ${it.message()}"

                    when (it.messageLevel()) {
                        ConsoleMessage.MessageLevel.TIP -> Log.v(jsTag, message)
                        ConsoleMessage.MessageLevel.LOG -> Log.i(jsTag, message)
                        ConsoleMessage.MessageLevel.WARNING -> Log.w(jsTag, message)
                        ConsoleMessage.MessageLevel.ERROR -> Log.e(jsTag, message)
                        ConsoleMessage.MessageLevel.DEBUG -> Log.d(jsTag, message)
                        else -> Log.d(jsTag, message)
                    }
                }
                return true
            }
        }

        // 添加JavaScript接口 - 使用封装类
        webView.addJavascriptInterface(
            WebViewJavaScriptInterface(webView, robotBridge),
            "RobotAPI"
        )

        setContentView(webView)

        // 🔊 注册音量变化监听器
        registerVolumeReceiver()

        // 获取要加载的URL
        val urlToLoad = intent.getStringExtra("url")
            ?: SettingsActivity.getSavedUrl(this)

        // 先尝试绑定 VAD 服务，绑定完成后再加载 URL
        // 这样前端可以通过 AndroidVad.isAvailable() 知道 VAD 是否可用
        vadBridge.initVadService { vadAvailable ->
            Log.i(TAG, "VAD 服务绑定结果: $vadAvailable")

            // 根据 VAD 是否可用，决定是否添加 AndroidVad 接口
            if (vadAvailable) {
                webView.addJavascriptInterface(vadBridge, "AndroidVad")
                Log.i(TAG, "AndroidVad 接口已添加")
            } else {
                Log.w(TAG, "VAD 服务不可用，不添加 AndroidVad 接口")
            }

            // 加载 URL
            loadUrl(urlToLoad)
        }
    }

    /**
     * 配置WebView设置
     */
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebSettings(settings: WebSettings) {
        settings.apply {
            // 启用JavaScript
            javaScriptEnabled = true

            // 启用DOM存储
            domStorageEnabled = true

            // 启用数据库
            databaseEnabled = true

            // 允许文件访问
            allowFileAccess = true
            allowContentAccess = true

            // 媒体权限
            mediaPlaybackRequiresUserGesture = false

            // 缓存设置
            cacheMode = WebSettings.LOAD_DEFAULT

            // 支持缩放
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false

            // 禁用自适应屏幕，让 setInitialScale 生效
            useWideViewPort = false
            loadWithOverviewMode = false

            // 支持混合内容
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // 其他设置
            javaScriptCanOpenWindowsAutomatically = true
            loadsImagesAutomatically = true

            // 用户代理
            userAgentString = "$userAgentString RobotBridge/1.0"
        }
    }

    /**
     * 加载URL
     */
    fun loadUrl(url: String) {
        Log.i(TAG, "加载URL: $url")
        webView.loadUrl(url)
    }

    /**
     * JavaScript接口封装类
     * 所有需要在WebView中执行的方法都需要通过这个类来调用
     */
    private inner class WebViewJavaScriptInterface(
        private val webView: WebView,
        private val bridge: RobotNavigationBridge
    ) {

        @android.webkit.JavascriptInterface
        fun isRobotEstimate(callbackName: String) {
            bridge.isRobotEstimate(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun getPosition(callbackName: String) {
            bridge.getPosition(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun getLocation(placeName: String, callbackName: String) {
            bridge.getLocation(placeName, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun setLocation(placeName: String, callbackName: String) {
            bridge.setLocation(placeName, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun getPlaceList(callbackName: String) {
            bridge.getPlaceList(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun getMapName(callbackName: String) {
            bridge.getMapName(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun startNavigation(placeName: String, callbackName: String, statusCallbackName: String? = null) {
            bridge.startNavigation(placeName, callbackName, statusCallbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun stopNavigation(callbackName: String) {
            bridge.stopNavigation(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun registerStatusListener(type: String, callbackName: String) {
            bridge.registerStatusListener(type, callbackName)
            // 不需要 executeCallback，因为这是长连接监听
        }

        @android.webkit.JavascriptInterface
        fun registerPersonListener(callbackName: String) {
            bridge.registerPersonListener(callbackName)
        }

        @android.webkit.JavascriptInterface
        fun getPersonList(callbackName: String) {
            bridge.getPersonList(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun moveHead(hAngle: Int, vAngle: Int, callbackName: String) {
            bridge.moveHead(hAngle, vAngle, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun resetHead(callbackName: String) {
            bridge.resetHead(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun setLight(type: Int, color: String, callbackName: String) {
            bridge.setLight(type, color, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun startFocusFollow(personId: Int, callbackName: String) {
            bridge.startFocusFollow(personId, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun stopFocusFollow(callbackName: String) {
            bridge.stopFocusFollow(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun goForward(speed: Double, distance: Double, avoid: Boolean, callbackName: String) {
            bridge.goForward(speed, distance, avoid, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun goBackward(speed: Double, distance: Double, callbackName: String) {
            bridge.goBackward(speed, distance, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun turnLeft(speed: Double, angle: Double, callbackName: String) {
            bridge.turnLeft(speed, angle, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun turnRight(speed: Double, angle: Double, callbackName: String) {
            bridge.turnRight(speed, angle, callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun startAutoCharge(timeout: Long, callbackName: String, statusCallbackName: String? = null) {
            bridge.startAutoCharge(timeout, callbackName, statusCallbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun stopAutoCharge(callbackName: String) {
            bridge.stopAutoCharge(callbackName)
            executeCallback(webView)
        }

        @android.webkit.JavascriptInterface
        fun leaveChargingPile(speed: Double, distance: Double, callbackName: String, statusCallbackName: String? = null) {
            bridge.leaveChargingPile(speed, distance, callbackName, statusCallbackName)
            executeCallback(webView)
        }

        /**
         * 执行JavaScript回调
         * 这个方法会在主线程上执行，确保JavaScript回调能够正常工作
         */
        private fun executeCallback(webView: WebView) {
            runOnUiThread {
                // JavaScript回调会通过evaluateJavascript执行
                // 这里预留接口，实际执行在RobotNavigationBridge的invokeJsCallback中
            }
        }
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        super.onDestroy()

        // 🔊 注销音量监听器
        volumeReceiver?.let {
            unregisterReceiver(it)
            volumeReceiver = null
            Log.i(TAG, "🔊 音量监听器已注销")
        }

        // 先断开RobotAPI连接和清理Bridge
        if (::robotBridge.isInitialized) {
            robotBridge.disconnectRobotApi()
        }

        // 清理 VAD Bridge
        if (::vadBridge.isInitialized) {
            vadBridge.destroy()
        }

        // 清理WebView
        if (::webView.isInitialized) {
            // 停止加载
            webView.stopLoading()

            // 移除JavaScript接口
            webView.removeJavascriptInterface("RobotAPI")
            // 只有 VAD 可用时才移除接口
            if (::vadBridge.isInitialized && vadBridge.isVadAvailable()) {
                webView.removeJavascriptInterface("AndroidVad")
            }

            // 清理WebView回调（不能设为null，使用空实现）
            webView.webViewClient = object : WebViewClient() {}
            webView.webChromeClient = null

            // 从父容器移除
            (webView.parent as? ViewGroup)?.removeView(webView)

            // 销毁WebView
            webView.destroy()
        }
    }
}