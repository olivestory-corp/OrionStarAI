package com.ainirobot.agent.vad;

interface IVadAudioListener {
    void onVadBegin(String sid);
    void onVadEnd(String sid);
    oneway void onAudioData(in byte[] data, int size);
    void onFilterVadData(String sid, boolean filter, int speakId, String reason);
}
