package com.e2e.orionstar.bridge

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import com.ainirobot.coreservice.client.ApiListener
import com.ainirobot.coreservice.client.Definition
import com.ainirobot.coreservice.client.RobotApi
import com.ainirobot.coreservice.client.StatusListener
import com.ainirobot.coreservice.client.listener.ActionListener
import com.ainirobot.coreservice.client.listener.CommandListener
import com.ainirobot.coreservice.client.person.PersonListener
import com.ainirobot.coreservice.client.person.PersonApi
import com.ainirobot.coreservice.client.actionbean.LeadingParams
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicInteger

/**
 * RobotAPI导航功能的JavaScript桥接类
 * 将RobotAPI的地图导航功能暴露给WebView中的JavaScript
 */
class RobotNavigationBridge(private val context: Context) {

    // WebView引用，用于执行JavaScript回调
    var webView: WebView? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "RobotNavBridge"
    }

    private val reqIdGenerator = AtomicInteger(1000)
    private var isRobotConnected = false

    // 保存注册的监听器，用于清理
    private val statusListeners = mutableListOf<Pair<String, StatusListener>>()
    private var personListener: PersonListener? = null

    /**
     * 初始化RobotAPI连接
     */
    fun initRobotApi() {
        RobotApi.getInstance().connectServer(context, object : ApiListener {
            override fun handleApiDisabled() {
                Log.w(TAG, "RobotApi disabled")
                isRobotConnected = false
            }

            override fun handleApiConnected() {
                Log.i(TAG, "RobotApi connected successfully")
                isRobotConnected = true
            }

            override fun handleApiDisconnected() {
                Log.w(TAG, "RobotApi disconnected")
                isRobotConnected = false
            }
        })
    }

    /**
     * 断开RobotAPI连接
     */
    fun disconnectRobotApi() {
        // 清理所有待处理的Handler消息
        mainHandler.removeCallbacksAndMessages(null)

        // 注销所有状态监听器
        statusListeners.forEach { (statusType, listener) ->
            try {
                RobotApi.getInstance().unregisterStatusListener(listener)
                Log.d(TAG, "Unregistered status listener: $statusType")
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering status listener", e)
            }
        }
        statusListeners.clear()

        // 注销人员监听器
        personListener?.let { listener ->
            try {
                PersonApi.getInstance().unregisterPersonListener(listener)
                Log.d(TAG, "Unregistered person listener")
            } catch (e: Exception) {
                Log.e(TAG, "Error unregistering person listener", e)
            }
        }
        personListener = null

        // 清理WebView引用，防止内存泄漏
        webView = null

        // RobotAPI没有disconnectServer方法，只需标记状态
        isRobotConnected = false

        Log.i(TAG, "RobotNavigationBridge cleaned up")
    }

    /**
     * 判断当前是否已定位
     * @param callbackName JavaScript回调函数名
     */
    fun isRobotEstimate(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().isRobotEstimate(reqId, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val isEstimated = "true" == message
                val response = JSONObject().apply {
                    put("success", true)
                    put("data", isEstimated)
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 获取机器人当前坐标点
     * @param callbackName JavaScript回调函数名
     */
    fun getPosition(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().getPosition(reqId, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                try {
                    val json = JSONObject(message ?: "{}")
                    val response = JSONObject().apply {
                        put("success", true)
                        put("data", JSONObject().apply {
                            put("x", json.optDouble(Definition.JSON_NAVI_POSITION_X, 0.0))
                            put("y", json.optDouble(Definition.JSON_NAVI_POSITION_Y, 0.0))
                            put("theta", json.optDouble(Definition.JSON_NAVI_POSITION_THETA, 0.0))
                        })
                    }
                    invokeJsCallback(callbackName, response.toString())
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing position", e)
                    invokeJsCallback(callbackName, createErrorResponse("解析位置数据失败: ${e.message}").toString())
                }
            }
        })
    }

    /**
     * 根据位置名称获取坐标点
     * @param placeName 位置名称
     * @param callbackName JavaScript回调函数名
     */
    fun getLocation(placeName: String, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().getLocation(reqId, placeName, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                try {
                    val json = JSONObject(message ?: "{}")
                    val isExist = json.optBoolean(Definition.JSON_NAVI_SITE_EXIST, false)

                    val response = JSONObject().apply {
                        put("success", true)
                        put("data", if (isExist) {
                            JSONObject().apply {
                                put("exist", true)
                                put("name", placeName)
                                put("x", json.optDouble(Definition.JSON_NAVI_POSITION_X, 0.0))
                                put("y", json.optDouble(Definition.JSON_NAVI_POSITION_Y, 0.0))
                                put("theta", json.optDouble(Definition.JSON_NAVI_POSITION_THETA, 0.0))
                            }
                        } else {
                            JSONObject().apply {
                                put("exist", false)
                                put("name", placeName)
                            }
                        })
                    }
                    invokeJsCallback(callbackName, response.toString())
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing location", e)
                    invokeJsCallback(callbackName, createErrorResponse("解析位置数据失败: ${e.message}").toString())
                }
            }
        })
    }

    /**
     * 设置当前位置名称（设点）
     * @param placeName 位置名称
     * @param callbackName JavaScript回调函数名
     */
    fun setLocation(placeName: String, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().setLocation(reqId, placeName, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val success = "succeed" == message
                val response = JSONObject().apply {
                    put("success", success)
                    if (success) {
                        put("data", JSONObject().apply {
                            put("placeName", placeName)
                            put("message", "位置保存成功")
                        })
                    } else {
                        put("error", "位置保存失败")
                    }
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 获取当前地图所有位置点
     * @param callbackName JavaScript回调函数名
     */
    fun getPlaceList(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().getPlaceList(reqId, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                try {
                    val jsonArray = JSONArray(message ?: "[]")
                    val places = JSONArray()

                    for (i in 0 until jsonArray.length()) {
                        val json = jsonArray.getJSONObject(i)
                        places.put(JSONObject().apply {
                            put("name", json.optString("name", ""))
                            put("x", json.optDouble("x", 0.0))
                            put("y", json.optDouble("y", 0.0))
                            put("theta", json.optDouble("theta", 0.0))
                            put("id", json.optString("id", ""))
                            put("time", json.optLong("time", 0))
                            put("status", json.optInt("status", 0))
                        })
                    }

                    val response = JSONObject().apply {
                        put("success", true)
                        put("data", places)
                    }
                    invokeJsCallback(callbackName, response.toString())
                } catch (e: Exception) {
                    Log.e(TAG, "Error parsing place list", e)
                    invokeJsCallback(callbackName, createErrorResponse("解析位置列表失败: ${e.message}").toString())
                }
            }
        })
    }

    /**
     * 获取当前地图名称
     * @param callbackName JavaScript回调函数名
     */
    fun getMapName(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().getMapName(reqId, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val response = JSONObject().apply {
                    put("success", true)
                    put("data", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 开始导航到指定位置
     * @param placeName 目标位置名称
     * @param callbackName JavaScript回调函数名（用于最终结果）
     * @param statusCallbackName JavaScript状态更新回调函数名（可选）
     */
    fun startNavigation(placeName: String, callbackName: String, statusCallbackName: String? = null) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        // 使用 AtomicBoolean 确保 callbackName 只被调用一次 (resolve/reject)
        val hasResponded = java.util.concurrent.atomic.AtomicBoolean(false)

        RobotApi.getInstance().startNavigation(
            reqId,
            placeName,
            0.5,  // coordinateDeviation
            300000L,  // timeout: 5分钟
            object : ActionListener() {
                override fun onResult(status: Int, responseString: String?) {
                    // 如果还没响应过启动结果（比如瞬间完成或失败），这里作为兜底
                    if (hasResponded.compareAndSet(false, true)) {
                        val response = JSONObject().apply {
                            put("success", true)
                            put("message", "导航已启动(Result)")
                            put("status", "started")
                        }
                        invokeJsCallback(callbackName, response.toString())
                    }

                    // 导航结束，如果有状态回调则通知
                    if (!statusCallbackName.isNullOrEmpty()) {
                        val response = JSONObject().apply {
                            put("type", "finished")
                            put("success", true)
                            put("status", status)
                            put("message", when (status) {
                                Definition.RESULT_OK -> "导航成功"
                                Definition.RESULT_NAVIGATION_ARRIVED -> "已到达目的地"
                                Definition.ACTION_RESPONSE_STOP_SUCCESS -> "导航已停止"
                                else -> "导航结束: $status"
                            })
                            put("data", JSONObject().apply {
                                put("statusCode", status)
                                put("destination", placeName)
                            })
                        }
                        invokeJsCallback(statusCallbackName, response.toString())
                    }
                }

                override fun onError(errorCode: Int, errorString: String?) {
                    // 如果还没响应过启动结果，这里报错给 Promise
                    if (hasResponded.compareAndSet(false, true)) {
                        val response = createErrorResponse("导航启动失败: $errorString (Code: $errorCode)")
                        invokeJsCallback(callbackName, response.toString())
                    }

                    // 导航错误，如果有状态回调则通知
                    if (!statusCallbackName.isNullOrEmpty()) {
                        val response = JSONObject().apply {
                            put("type", "error")
                            put("success", false)
                            put("error", errorString ?: "导航错误")
                            put("errorCode", errorCode)
                            put("message", getNavigationErrorMessage(errorCode))
                        }
                        invokeJsCallback(statusCallbackName, response.toString())
                    }
                }

                override fun onStatusUpdate(status: Int, data: String?, extraData: String?) {
                    // 🎯 关键修改：监听 STATUS_START_NAVIGATION
                    if (status == Definition.STATUS_START_NAVIGATION) {
                        if (hasResponded.compareAndSet(false, true)) {
                            val response = JSONObject().apply {
                                put("success", true)
                                put("message", "导航已启动")
                                put("status", "started")
                            }
                            invokeJsCallback(callbackName, response.toString())
                        }
                    }

                    if (!statusCallbackName.isNullOrEmpty()) {
                        val statusResponse = JSONObject().apply {
                            put("type", "update")
                            put("status", status)
                            put("message", getNavigationStatusMessage(status))
                            put("data", data)
                            put("extraData", extraData)
                        }
                        invokeJsCallback(statusCallbackName, statusResponse.toString())
                    }
                }
            }
        )
    }

    /**
     * 停止导航
     * @param callbackName JavaScript回调函数名
     */
    fun stopNavigation(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().stopNavigation(reqId)

        val response = JSONObject().apply {
            put("success", true)
            put("message", "停止导航指令已发送")
        }
        invokeJsCallback(callbackName, response.toString())
    }

    /**
     * 开始自动回充
     * 机器人会自动导航到充电桩并开始充电
     * @param timeout 导航超时时间(毫秒)
     * @param callbackName JavaScript回调函数名（用于最终结果）
     * @param statusCallbackName JavaScript状态更新回调函数名（可选）
     */
    fun startAutoCharge(timeout: Long, callbackName: String, statusCallbackName: String? = null) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        // 使用 AtomicBoolean 确保 callbackName 只被调用一次 (resolve/reject)
        val hasResponded = java.util.concurrent.atomic.AtomicBoolean(false)

        RobotApi.getInstance().startNaviToAutoChargeAction(
            reqId,
            timeout,
            object : ActionListener() {
                override fun onResult(status: Int, responseString: String?) {
                    Log.d(TAG, "startAutoCharge onResult: $status, $responseString");
                    // 如果还没响应过启动结果，这里作为兜底
                    if (hasResponded.compareAndSet(false, true)) {
                        val response = JSONObject().apply {
                            put("success", true)
                            put("message", "自动回充已启动(Result)")
                            put("status", "started")
                        }
                        invokeJsCallback(callbackName, response.toString())
                    }

                    // 回充结束，如果有状态回调则通知
                    if (!statusCallbackName.isNullOrEmpty()) {
                        val response = JSONObject().apply {
                            put("type", "finished")
                            put("success", status == Definition.RESULT_OK)
                            put("status", status)
                            put("message", when (status) {
                                Definition.RESULT_OK -> "充电成功"
                                Definition.RESULT_FAILURE -> "充电失败"
                                Definition.ACTION_RESPONSE_STOP_SUCCESS -> "回充已停止"
                                else -> "回充结束: $status"
                            })
                            put("data", JSONObject().apply {
                                put("statusCode", status)
                            })
                        }
                        invokeJsCallback(statusCallbackName, response.toString())
                    }
                }

                override fun onError(errorCode: Int, errorString: String?) {
                    Log.d(TAG, "startAutoCharge onError: $errorCode, $errorString");

                    // 如果还没响应过启动结果，这里报错给 Promise
                    if (hasResponded.compareAndSet(false, true)) {
                        val response = createErrorResponse("自动回充启动失败: $errorString (Code: $errorCode)")
                        invokeJsCallback(callbackName, response.toString())
                    }

                    // 回充错误，如果有状态回调则通知
                    if (!statusCallbackName.isNullOrEmpty()) {
                        val response = JSONObject().apply {
                            put("type", "error")
                            put("success", false)
                            put("error", errorString ?: "回充错误")
                            put("errorCode", errorCode)
                            put("message", getNavigationErrorMessage(errorCode))
                        }
                        invokeJsCallback(statusCallbackName, response.toString())
                    }
                }

                override fun onStatusUpdate(status: Int, data: String?, extraData: String?) {
                    Log.d(TAG, "startAutoCharge onStatusUpdate: $status, $data");

                    // 监听导航开始作为启动成功的标志
                    if (status == Definition.STATUS_START_NAVIGATION) {
                        if (hasResponded.compareAndSet(false, true)) {
                            val response = JSONObject().apply {
                                put("success", true)
                                put("message", "自动回充已启动")
                                put("status", "started")
                            }
                            invokeJsCallback(callbackName, response.toString())
                        }
                    }

                    if (!statusCallbackName.isNullOrEmpty()) {
                        val statusResponse = JSONObject().apply {
                            put("type", "update")
                            put("status", status)
                            put("message", getAutoChargeStatusMessage(status))
                            put("data", data)
                            put("extraData", extraData)
                        }
                        invokeJsCallback(statusCallbackName, statusResponse.toString())
                    }
                }
            }
        )
    }

    /**
     * 停止自动回充
     * @param callbackName JavaScript回调函数名
     */
    fun stopAutoCharge(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().stopAutoChargeAction(reqId, true)

        val response = JSONObject().apply {
            put("success", true)
            put("message", "停止回充指令已发送")
        }
        invokeJsCallback(callbackName, response.toString())
    }

    /**
     * 停止充电并脱离充电桩
     * @param speed 离桩速度 (m/s, 建议 0.1~0.3)
     * @param distance 离桩距离 (m, 建议 0.5~1.0)
     * @param callbackName JavaScript回调函数名
     * @param statusCallbackName JavaScript状态更新回调函数名（可选）
     */
    fun leaveChargingPile(speed: Double, distance: Double, callbackName: String, statusCallbackName: String? = null) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        val hasResponded = java.util.concurrent.atomic.AtomicBoolean(false)

        RobotApi.getInstance().leaveChargingPile(reqId, speed.toFloat(), distance.toFloat(), object : CommandListener() {
            override fun onStatusUpdate(status: Int, data: String?, extraData: String?) {
                if (!statusCallbackName.isNullOrEmpty()) {
                    val statusResponse = JSONObject().apply {
                        put("type", "update")
                        put("status", status)
                        put("message", getLeaveChargingPileStatusMessage(status))
                        put("data", data)
                        put("extraData", extraData)
                    }
                    mainHandler.post {
                        webView?.evaluateJavascript(
                            "javascript:if(typeof $statusCallbackName === 'function'){$statusCallbackName(${statusResponse.toString()});}",
                            null
                        )
                    }
                }
            }

            override fun onError(errorCode: Int, errorString: String?, extraData: String?) {
                if (hasResponded.compareAndSet(false, true)) {
                    val errorMsg = getLeaveChargingPileErrorMessage(errorCode)
                    val response = createErrorResponse("离桩失败: $errorMsg (Code: $errorCode)")
                    invokeJsCallback(callbackName, response.toString())
                }

                if (!statusCallbackName.isNullOrEmpty()) {
                    val response = JSONObject().apply {
                        put("type", "error")
                        put("success", false)
                        put("error", errorString ?: "离桩错误")
                        put("errorCode", errorCode)
                        put("message", getLeaveChargingPileErrorMessage(errorCode))
                    }
                    mainHandler.post {
                        webView?.evaluateJavascript(
                            "javascript:if(typeof $statusCallbackName === 'function'){$statusCallbackName(${response.toString()});}",
                            null
                        )
                    }
                }
            }

            override fun onResult(result: Int, message: String?, extraData: String?) {
                if (hasResponded.compareAndSet(false, true)) {
                    val success = result == Definition.RESULT_OK
                    val response = JSONObject().apply {
                        put("success", success)
                        put("message", if (success) "离桩成功" else "离桩失败: $message")
                        put("result", result)
                    }
                    invokeJsCallback(callbackName, response.toString())
                }

                if (!statusCallbackName.isNullOrEmpty()) {
                    val response = JSONObject().apply {
                        put("type", "finished")
                        put("success", result == Definition.RESULT_OK)
                        put("result", result)
                        put("message", if (result == Definition.RESULT_OK) "离桩成功" else "离桩结束: $message")
                    }
                    mainHandler.post {
                        webView?.evaluateJavascript(
                            "javascript:if(typeof $statusCallbackName === 'function'){$statusCallbackName(${response.toString()});}",
                            null
                        )
                    }
                }
            }
        })
    }

    /**
     * 获取离桩错误信息
     */
    private fun getLeaveChargingPileErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            Definition.RESULT_FAILURE_MOTION_AVOID_STOP -> "前方有障碍，离桩失败"
            Definition.RESULT_FAILURE_TIMEOUT -> "离桩超时(15s)"
            Definition.STATUS_LEAVE_PILE_OPEN_RADAR_FAILURE -> "雷达启动失败"
            else -> "离桩错误: $errorCode"
        }
    }

    /**
     * 获取离桩状态信息
     */
    private fun getLeaveChargingPileStatusMessage(status: Int): String {
        return when (status) {
            Definition.STATUS_LEAVE_PILE_OPEN_RADAR_FAILURE -> "雷达启动失败"
            else -> "离桩状态更新: $status"
        }
    }

    /**
     * 注册状态监听器
     * @param type 监听类型 (pose, battery, emergency)
     * @param callbackName JavaScript回调函数名
     */
    fun registerStatusListener(type: String, callbackName: String) {
        if (!isRobotConnected) {
            Log.w(TAG, "RobotAPI未连接，无法注册监听: $type")
            return
        }

        val statusType = when (type) {
            "pose" -> Definition.STATUS_POSE
            "battery" -> Definition.STATUS_BATTERY
            "emergency" -> Definition.STATUS_EMERGENCY
            "robot_pushed" -> Definition.STATUS_ROBOT_BEING_PUSHED
            "map_outside" -> Definition.STATUS_MAP_OUTSIDE
            else -> {
                Log.w(TAG, "未知的监听类型: $type")
                return
            }
        }

        // 注册监听器
        val statusListener = object : StatusListener() {
            override fun onStatusUpdate(type: String?, value: String?) {
                // 构造统一的事件对象
                val event = JSONObject().apply {
                    put("type", type)
                    put("value", value) // 原始数据字符串，通常是 JSON
                    put("timestamp", System.currentTimeMillis())
                }

                // 调用 JS 回调 (注意：这里是多次调用，不能用 invokeJsCallback 的一次性逻辑)
                mainHandler.post {
                    webView?.evaluateJavascript(
                        "javascript:if(typeof $callbackName === 'function'){$callbackName(${event.toString()});}",
                        null
                    )
                }
            }
        }

        RobotApi.getInstance().registerStatusListener(statusType, statusListener)
        // 保存监听器引用以便后续清理（保存type字符串用于日志）
        statusListeners.add(Pair(type, statusListener))

        Log.i(TAG, "已注册状态监听: $type -> $statusType")
    }

    /**
     * 注册人员检测监听器
     * @param callbackName JavaScript回调函数名
     */
    fun registerPersonListener(callbackName: String) {
        if (!isRobotConnected) {
            Log.w(TAG, "RobotAPI未连接，无法注册人员监听")
            return
        }

        val listener = object : PersonListener() {
            override fun personChanged() {
                try {
                    // 人员变化时，获取当前视野内的人员列表
                    val persons = PersonApi.getInstance().allPersons
                    val jsonArray = JSONArray()

                    persons?.forEach { person ->
                        val personJson = JSONObject().apply {
                            put("id", person.id)
                            put("distance", person.distance)
                            put("angle", person.angleInView)
                            put("faceX", person.faceX)
                            put("faceY", person.faceY)
                            put("age", person.age)
                            put("gender", person.gender)
                            put("glasses", person.glasses)
                        }
                        jsonArray.put(personJson)
                    }

                    val response = JSONObject().apply {
                        put("type", "person_detected")
                        put("count", persons?.size ?: 0)
                        put("data", jsonArray)
                        put("timestamp", System.currentTimeMillis())
                    }

                    // 调用 JS 回调
                    mainHandler.post {
                        webView?.evaluateJavascript(
                            "javascript:if(typeof $callbackName === 'function'){$callbackName(${response.toString()});}",
                            null
                        )
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error in personChanged callback", e)
                }
            }
        }

        PersonApi.getInstance().registerPersonListener(listener)
        // 保存监听器引用以便后续清理
        personListener = listener

        Log.i(TAG, "已注册人员检测监听")
    }

    /**
     * 获取当前检测到的人员列表
     * @param callbackName JavaScript回调函数名
     */
    fun getPersonList(callbackName: String) {
        if (!checkConnection(callbackName)) return

        try {
            val persons = PersonApi.getInstance().allPersons
            val jsonArray = JSONArray()

            persons?.forEach { person ->
                val personJson = JSONObject().apply {
                    put("id", person.id)
                    put("distance", person.distance)
                    put("angle", person.angleInView)
                    put("faceX", person.faceX)
                    put("faceY", person.faceY)
                    put("age", person.age)
                    put("gender", person.gender)
                    put("glasses", person.glasses)
                }
                jsonArray.put(personJson)
            }

            val response = JSONObject().apply {
                put("success", true)
                put("data", jsonArray)
                put("count", persons?.size ?: 0)
            }
            invokeJsCallback(callbackName, response.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Error getting person list", e)
            invokeJsCallback(callbackName, createErrorResponse("获取人员列表失败: ${e.message}").toString())
        }
    }

    // ========== 头部控制 ==========

    /**
     * 控制头部运动
     * @param hAngle 水平角度 (-120 ~ 120)
     * @param vAngle 垂直角度 (0 ~ 90)
     * @param callbackName JavaScript回调函数名
     */
    fun moveHead(hAngle: Int, vAngle: Int, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        // 绝对运动模式: absolute
        RobotApi.getInstance().moveHead(reqId, "absolute", "absolute", hAngle, vAngle, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val response = JSONObject().apply {
                    put("success", result == Definition.RESULT_OK)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 头部复位
     * @param callbackName JavaScript回调函数名
     */
    fun resetHead(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().resetHead(reqId, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val response = JSONObject().apply {
                    put("success", result == Definition.RESULT_OK)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    // ========== 灯光控制 ==========

    /**
     * 设置灯光效果
     * @param type 灯光类型 (0: 普通)
     * @param color 颜色 (RGB Hex String, e.g., "FF0000")
     * @param callbackName JavaScript回调函数名
     */
    fun setLight(type: Int, color: String, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        try {
            val params = JSONObject().apply {
                put(Definition.JSON_LAMB_TYPE, type)
                put(Definition.JSON_LAMB_TARGET, 0)
                put(Definition.JSON_LAMB_RGB_START, color)
                put(Definition.JSON_LAMB_RGB_END, color)
                put(Definition.JSON_LAMB_RGB_FREEZE, color)
                put(Definition.JSON_LAMB_ON_TIME, 5000) // 默认亮5秒
            }

            RobotApi.getInstance().setLight(reqId, params.toString(), object : ActionListener() {
                override fun onResult(status: Int, responseString: String?) {
                    val response = JSONObject().apply {
                        put("success", status == Definition.RESULT_OK)
                        put("message", responseString ?: "")
                    }
                    invokeJsCallback(callbackName, response.toString())
                }

                override fun onError(errorCode: Int, errorString: String?) {
                     val response = createErrorResponse("灯光设置失败: $errorString")
                     invokeJsCallback(callbackName, response.toString())
                }

                override fun onStatusUpdate(status: Int, data: String?) {}
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error setting light", e)
            invokeJsCallback(callbackName, createErrorResponse("灯光参数错误: ${e.message}").toString())
        }
    }

    // ========== 引领与跟随 ==========

    /**
     * 开始焦点跟随
     * @param personId 人员ID
     * @param callbackName JavaScript回调函数名
     */
    fun startFocusFollow(personId: Int, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        // 使用 AtomicBoolean 确保 callbackName 只被调用一次 (resolve/reject)
        val hasResponded = java.util.concurrent.atomic.AtomicBoolean(false)

        RobotApi.getInstance().startFocusFollow(reqId, personId, 10000, 3.0f, object : ActionListener() {
            override fun onResult(status: Int, responseString: String?) {
                // 如果还没响应过启动结果，这里作为兜底 (例如立即停止)
                if (hasResponded.compareAndSet(false, true)) {
                    val response = JSONObject().apply {
                        put("success", true)
                        put("message", "跟随已结束(Result)")
                    }
                    invokeJsCallback(callbackName, response.toString())
                }
            }

            override fun onError(errorCode: Int, errorString: String?) {
                // 如果还没响应过启动结果，这里报错给 Promise
                if (hasResponded.compareAndSet(false, true)) {
                    val errorMsg = errorString ?: "未知错误"
                    val response = createErrorResponse("跟随失败: $errorMsg (Code: $errorCode)")
                    invokeJsCallback(callbackName, response.toString())
                }
            }

            override fun onStatusUpdate(status: Int, data: String?) {
                // 监听 STATUS_TRACK_TARGET_SUCCEED 作为启动成功的标志
                if (status == Definition.STATUS_TRACK_TARGET_SUCCEED) {
                    if (hasResponded.compareAndSet(false, true)) {
                        val response = JSONObject().apply {
                            put("success", true)
                            put("message", "跟随已启动")
                            put("status", "started")
                        }
                        invokeJsCallback(callbackName, response.toString())
                    }
                }
                // 其他状态 (LOST, FARAWAY, APPEAR) 可以通过日志或额外的事件通道发送
                Log.d(TAG, "FocusFollow Status: $status")
            }
        })
    }

    /**
     * 停止焦点跟随
     * @param callbackName JavaScript回调函数名
     */
    fun stopFocusFollow(callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().stopFocusFollow(reqId)

        val response = JSONObject().apply {
            put("success", true)
            put("message", "停止跟随指令已发送")
        }
        invokeJsCallback(callbackName, response.toString())
    }

    // ========== 运动控制 (直行/旋转) ==========

    /**
     * 前进
     * @param speed 速度 (m/s, 0~1.0)
     * @param distance 距离 (m, >0)
     * @param avoid 是否避障
     * @param callbackName JavaScript回调函数名
     */
    fun goForward(speed: Double, distance: Double, avoid: Boolean, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        // RobotApi.getInstance().goForward(reqId, speed, distance, avoid, listener)
        // 注意：根据文档，speed类型可能是 float，这里强转一下
        RobotApi.getInstance().goForward(reqId, speed.toFloat(), distance.toFloat(), avoid, object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val success = "succeed" == message
                val response = JSONObject().apply {
                    put("success", success)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 后退
     * @param speed 速度 (m/s, 0~1.0)
     * @param distance 距离 (m, >0)
     * @param callbackName JavaScript回调函数名
     */
    fun goBackward(speed: Double, distance: Double, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().goBackward(reqId, speed.toFloat(), distance.toFloat(), object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val success = "succeed" == message
                val response = JSONObject().apply {
                    put("success", success)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 左转
     * @param speed 速度 (度/s, 0~50)
     * @param angle 角度 (度, >0)
     * @param callbackName JavaScript回调函数名
     */
    fun turnLeft(speed: Double, angle: Double, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().turnLeft(reqId, speed.toFloat(), angle.toFloat(), object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val success = "succeed" == message
                val response = JSONObject().apply {
                    put("success", success)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    /**
     * 右转
     * @param speed 速度 (度/s, 0~50)
     * @param angle 角度 (度, >0)
     * @param callbackName JavaScript回调函数名
     */
    fun turnRight(speed: Double, angle: Double, callbackName: String) {
        if (!checkConnection(callbackName)) return

        val reqId = reqIdGenerator.incrementAndGet()
        RobotApi.getInstance().turnRight(reqId, speed.toFloat(), angle.toFloat(), object : CommandListener() {
            override fun onResult(result: Int, message: String?) {
                val success = "succeed" == message
                val response = JSONObject().apply {
                    put("success", success)
                    put("message", message ?: "")
                }
                invokeJsCallback(callbackName, response.toString())
            }
        })
    }

    // ========== 辅助方法 ==========

    /**
     * 检查RobotAPI连接状态
     */
    private fun checkConnection(callbackName: String): Boolean {
        if (!isRobotConnected) {
            val response = createErrorResponse("RobotAPI未连接，请先初始化")
            invokeJsCallback(callbackName, response.toString())
            return false
        }
        return true
    }

    /**
     * 创建错误响应
     */
    private fun createErrorResponse(errorMessage: String): JSONObject {
        return JSONObject().apply {
            put("success", false)
            put("error", errorMessage)
        }
    }

    /**
     * 调用JavaScript回调函数
     */
    private fun invokeJsCallback(callbackName: String, jsonResponse: String) {
        mainHandler.post {
            webView?.evaluateJavascript(
                "javascript:if(typeof $callbackName === 'function'){$callbackName($jsonResponse);}",
                null
            )
            Log.d(TAG, "Invoked JS callback: $callbackName")
        }
    }

    /**
     * 获取导航错误信息
     */
    private fun getNavigationErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            Definition.ERROR_NOT_ESTIMATE -> "机器人未定位"
            Definition.ERROR_DESTINATION_NOT_EXIST -> "目的地不存在"
            Definition.ERROR_IN_DESTINATION -> "已经在目的地"
            Definition.ERROR_DESTINATION_CAN_NOT_ARRAIVE -> "目的地不可达"
            Definition.ERROR_TARGET_NOT_FOUND -> "未找到目标点"
            Definition.ERROR_ESTIMATE_ERROR -> "重定位失败"
            Definition.ERROR_NAVIGATION_AVOID_TIMEOUT -> "避障超时"
            Definition.ERROR_MULTI_ROBOT_WAITING_TIMEOUT -> "多机避障等待超时"
            Definition.ACTION_RESPONSE_ALREADY_RUN -> "导航任务已在运行"
            Definition.ACTION_RESPONSE_REQUEST_RES_ERROR -> "请求资源错误"
            else -> "未知错误: $errorCode"
        }
    }

    /**
     * 获取导航状态信息
     */
    private fun getNavigationStatusMessage(status: Int): String {
        return when (status) {
            Definition.STATUS_START_NAVIGATION -> "导航开始"
            Definition.STATUS_ESTIMATE_LOST -> "定位丢失"
            Definition.STATUS_NAVI_AVOID -> "开始避障"
            Definition.STATUS_NAVI_AVOID_END -> "避障结束"
            Definition.STATUS_GOAL_OCCLUDED -> "目标被遮挡"
            Definition.STATUS_GOAL_OCCLUDED_END -> "目标遮挡解除"
            Definition.STATUS_NAVI_OUT_MAP -> "超出地图范围"
            Definition.STATUS_NAVI_GLOBAL_PATH_FAILED -> "全局路径规划失败"
            Definition.STATUS_DISTANCE_WITH_DESTINATION -> "距离目的地"
            else -> "导航状态更新: $status"
        }
    }

    /**
     * 获取自动回充状态信息
     */
    private fun getAutoChargeStatusMessage(status: Int): String {
        return when (status) {
            Definition.STATUS_START_NAVIGATION -> "正在前往充电桩"
            Definition.STATUS_NAVI_AVOID -> "回充途中避障"
            Definition.STATUS_NAVI_AVOID_END -> "避障结束，继续回充"
            Definition.STATUS_NAVI_OUT_MAP -> "充电桩位置超出地图范围"
            Definition.STATUS_NAVI_GLOBAL_PATH_FAILED -> "无法规划到充电桩的路径"
            else -> getNavigationStatusMessage(status)
        }
    }
}
