package com.ainirobot.agent.vad;

import com.ainirobot.agent.vad.IVadAudioListener;

interface IVadAudioService {
    void registerListener(IVadAudioListener listener);
    void unregisterListener(IVadAudioListener listener);

    /**
     * 设置麦克风静音状态
     * @param muted true 表示静音，false 表示取消静音
     */
    void setMicrophoneMuted(boolean muted);

    /**
     * 获取麦克风静音状态
     * @return true 表示静音，false 表示未静音
     */
    boolean isMicrophoneMuted();
}