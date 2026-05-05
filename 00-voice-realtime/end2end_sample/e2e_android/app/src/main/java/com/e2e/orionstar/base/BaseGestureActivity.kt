package com.e2e.orionstar.base

import android.content.res.Resources
import android.os.Bundle
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import com.e2e.orionstar.E2EApplication
import com.e2e.orionstar.gesture.SwipeBackGestureDetector

/**
 * 基础Activity - 提供双指右滑返回功能
 * 所有需要支持手势返回的Activity都应该继承此类
 */
abstract class BaseGestureActivity : ComponentActivity() {

    private lateinit var gestureDetector: SwipeBackGestureDetector

    override fun onCreate(savedInstanceState: Bundle?) {
        // 在 super.onCreate 之前设置 DPI
        E2EApplication.setDpi(resources)

        super.onCreate(savedInstanceState)

        // 初始化手势检测器
        gestureDetector = SwipeBackGestureDetector {
            onSwipeBackDetected()
        }
    }

    override fun getResources(): Resources {
        val res = super.getResources()
        if (res.displayMetrics.densityDpi != E2EApplication.DEFAULT_DPI) {
            E2EApplication.setDpi(res)
        }
        return res
    }

    /**
     * 拦截触摸事件以检测手势
     */
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        // 先让手势检测器处理
        if (gestureDetector.onTouchEvent(ev)) {
            return true
        }
        // 如果手势未处理，继续正常的触摸事件分发
        return super.dispatchTouchEvent(ev)
    }

    /**
     * 当双指右滑手势被检测到时调用
     * 默认行为是finish当前Activity
     * 子类可以重写此方法自定义行为
     */
    protected open fun onSwipeBackDetected() {
        // 销毁当前Activity
        finish()
    }
}
