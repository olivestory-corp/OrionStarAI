package com.e2e.orionstar.gesture

import android.util.Log
import android.view.MotionEvent
import kotlin.math.abs

/**
 * 双指右滑手势检测器
 * 用于检测双指向右滑动手势以触发返回操作
 */
class SwipeBackGestureDetector(
    private val onSwipeBack: () -> Unit
) {
    companion object {
        private const val TAG = "SwipeBackGesture"

        // 手势参数
        private const val MIN_SWIPE_DISTANCE = 200f  // 最小滑动距离（像素）
        private const val MAX_VERTICAL_DEVIATION = 150f  // 最大垂直偏移（像素）
        private const val MIN_VELOCITY = 300f  // 最小滑动速度（像素/秒）
        private const val REQUIRED_POINTER_COUNT = 2  // 需要的手指数量
    }

    private var startX1 = 0f
    private var startY1 = 0f
    private var startX2 = 0f
    private var startY2 = 0f
    private var startTime = 0L
    private var isGestureStarted = false

    /**
     * 处理触摸事件
     * @return true 如果手势被处理，false 否则
     */
    fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                // 当第二个手指按下时
                if (event.pointerCount == REQUIRED_POINTER_COUNT) {
                    handleGestureStart(event)
                }
            }

            MotionEvent.ACTION_MOVE -> {
                // 手指移动时检测滑动
                if (isGestureStarted && event.pointerCount == REQUIRED_POINTER_COUNT) {
                    return handleGestureMove(event)
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> {
                // 手指抬起或取消时重置状态
                if (event.pointerCount < REQUIRED_POINTER_COUNT) {
                    resetGesture()
                }
            }
        }
        return false
    }

    /**
     * 开始手势检测
     */
    private fun handleGestureStart(event: MotionEvent) {
        try {
            startX1 = event.getX(0)
            startY1 = event.getY(0)
            startX2 = event.getX(1)
            startY2 = event.getY(1)
            startTime = System.currentTimeMillis()
            isGestureStarted = true

            Log.d(TAG, "手势开始: 双指位置 (${startX1}, ${startY1}), (${startX2}, ${startY2})")
        } catch (e: Exception) {
            Log.e(TAG, "手势开始异常: ${e.message}")
            resetGesture()
        }
    }

    /**
     * 处理手势移动
     */
    private fun handleGestureMove(event: MotionEvent): Boolean {
        try {
            val currentX1 = event.getX(0)
            val currentY1 = event.getY(0)
            val currentX2 = event.getX(1)
            val currentY2 = event.getY(1)

            // 计算两个手指的移动距离
            val deltaX1 = currentX1 - startX1
            val deltaY1 = currentY1 - startY1
            val deltaX2 = currentX2 - startX2
            val deltaY2 = currentY2 - startY2

            // 两个手指都需要向右滑动
            if (deltaX1 > MIN_SWIPE_DISTANCE && deltaX2 > MIN_SWIPE_DISTANCE) {
                // 检查垂直偏移是否在允许范围内
                if (abs(deltaY1) < MAX_VERTICAL_DEVIATION && abs(deltaY2) < MAX_VERTICAL_DEVIATION) {
                    // 计算滑动速度
                    val duration = System.currentTimeMillis() - startTime
                    if (duration > 0) {
                        val avgDeltaX = (deltaX1 + deltaX2) / 2
                        val velocity = (avgDeltaX / duration) * 1000  // 像素/秒

                        if (velocity > MIN_VELOCITY) {
                            Log.i(TAG, "双指右滑手势触发: 距离=${avgDeltaX}px, 速度=${velocity}px/s")
                            onSwipeBack()
                            resetGesture()
                            return true
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "手势移动处理异常: ${e.message}")
            resetGesture()
        }
        return false
    }

    /**
     * 重置手势状态
     */
    private fun resetGesture() {
        isGestureStarted = false
        startX1 = 0f
        startY1 = 0f
        startX2 = 0f
        startY2 = 0f
        startTime = 0L
    }
}
