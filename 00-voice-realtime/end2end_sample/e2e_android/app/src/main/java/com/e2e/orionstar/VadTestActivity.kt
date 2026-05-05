package com.e2e.orionstar

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.e2e.orionstar.base.BaseGestureActivity
import com.ainirobot.agent.vad.IVadAudioListener
import com.ainirobot.agent.vad.IVadAudioService
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

class VadTestActivity : BaseGestureActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var tvSid: TextView
    private lateinit var tvDataCount: TextView
    private lateinit var rvSessions: RecyclerView
    private lateinit var btnClearLog: Button

    private val handler = Handler(Looper.getMainLooper())
    private var totalBytes = 0L

    private var vadAudioService: IVadAudioService? = null

    // Data Model
    data class VadSession(
        val sid: String,
        val startTime: String,
        var endTime: String = "",
        val pcmData: ByteArrayOutputStream = ByteArrayOutputStream(),
        var isComplete: Boolean = false
    )

    private val sessions = ArrayList<VadSession>()
    private val sessionMap = ConcurrentHashMap<String, VadSession>()
    private lateinit var adapter: SessionAdapter

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            showToast("Service Connected")
            try {
                vadAudioService = IVadAudioService.Stub.asInterface(service)
                vadAudioService?.registerListener(vadListener)
            } catch (e: Exception) {
                showToast("Error registering listener: ${e.message}")
                e.printStackTrace()
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            showToast("Service Disconnected")
            vadAudioService = null
        }
    }

    private val vadListener = object : IVadAudioListener.Stub() {
        override fun onVadBegin(sid: String?) {
            val safeSid = sid ?: "unknown"
            val time = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()).format(Date())
            val session = VadSession(safeSid, time)

            sessionMap[safeSid] = session

            handler.post {
                updateStatus("Speaking")
                tvSid.text = safeSid
                totalBytes = 0
                updateDataCount()

                sessions.add(0, session)
                adapter.notifyItemInserted(0)
                rvSessions.scrollToPosition(0)
            }
        }

        override fun onVadEnd(sid: String?) {
            val safeSid = sid ?: return
            val session = sessionMap[safeSid]
            session?.isComplete = true
            session?.endTime = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()).format(Date())

            handler.post {
                updateStatus("Idle")
                adapter.notifyDataSetChanged()
            }
        }

        override fun onAudioData(data: ByteArray?, len: Int) {
            if (data != null && len > 0) {
                if (sessions.isNotEmpty()) {
                    val currentSession = sessions[0]
                    if (!currentSession.isComplete) {
                        synchronized(currentSession) {
                            currentSession.pcmData.write(data, 0, len)
                        }
                        handler.post {
                            totalBytes += len
                            updateDataCount()
                        }
                    }
                }
            }
        }

        override fun onFilterVadData(sid: String?, filter: Boolean, speakId: Int, reason: String?) {
            handler.post {
                val msg = "FilterVadData: sid=$sid, filter=$filter, speakId=$speakId, reason=$reason"
                showToast(msg)
                // 也可以在界面上显示更详细的日志
                tvStatus.text = if (filter) "Filtered: $reason" else "Accepted"
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_vad_test)

        tvStatus = findViewById(R.id.tv_status)
        tvSid = findViewById(R.id.tv_sid)
        tvDataCount = findViewById(R.id.tv_data_count)
        rvSessions = findViewById(R.id.rv_sessions)
        btnClearLog = findViewById(R.id.btn_clear_log)

        setupRecyclerView()

        btnClearLog.setOnClickListener {
            sessions.clear()
            sessionMap.clear()
            adapter.notifyDataSetChanged()
        }

        bindVadService()
    }

    private fun setupRecyclerView() {
        adapter = SessionAdapter(sessions) { session ->
            playAudio(session)
        }
        rvSessions.layoutManager = LinearLayoutManager(this)
        rvSessions.adapter = adapter
    }

    private fun bindVadService() {
        val intent = Intent("com.ainirobot.agent.vad.VadAudioService")
        intent.setPackage("com.ainirobot.agentservice")

        try {
            val bound = bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            if (!bound) {
                showToast("Bind service failed")
            }
        } catch (e: Exception) {
            showToast("Bind exception: ${e.message}")
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (vadAudioService != null) {
            try {
                vadAudioService?.unregisterListener(vadListener)
                unbindService(serviceConnection)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun updateStatus(status: String) {
        tvStatus.text = status
    }

    private fun updateDataCount() {
        tvDataCount.text = "$totalBytes bytes"
    }

    private fun showToast(msg: String) {
        handler.post {
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }
    }

    private fun playAudio(session: VadSession) {
        val data = session.pcmData.toByteArray()
        if (data.isEmpty()) {
            showToast("No audio data")
            return
        }

        showToast("Playing ${data.size} bytes...")

        Thread {
            try {
                val minBufferSize = AudioTrack.getMinBufferSize(
                    16000,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )

                // 使用 MODE_STREAM，缓冲区大小设为 minBufferSize 的 4 倍
                val bufferSize = minBufferSize * 4

                val audioTrack = AudioTrack(
                    AudioManager.STREAM_MUSIC,
                    16000,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize,
                    AudioTrack.MODE_STREAM
                )

                if (audioTrack.state == AudioTrack.STATE_INITIALIZED) {
                    audioTrack.play()

                    // 分块写入数据
                    var offset = 0
                    while (offset < data.size) {
                        val chunkSize = Math.min(bufferSize, data.size - offset)
                        val written = audioTrack.write(data, offset, chunkSize)
                        if (written < 0) {
                            showToast("Write error: $written")
                            break
                        }
                        offset += written
                    }

                    audioTrack.stop()
                    audioTrack.release()
                } else {
                    showToast("AudioTrack init failed")
                }
            } catch (e: Exception) {
                e.printStackTrace()
                showToast("Playback error: ${e.message}")
            }
        }.start()
    }

    // RecyclerView Adapter
    inner class SessionAdapter(
        private val items: List<VadSession>,
        private val onItemClick: (VadSession) -> Unit
    ) : RecyclerView.Adapter<SessionAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val tvTitle: TextView = view.findViewById(android.R.id.text1)
            val tvSubtitle: TextView = view.findViewById(android.R.id.text2)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(android.R.layout.simple_list_item_2, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            val timeRange = if (item.isComplete) "${item.startTime} - ${item.endTime}" else "${item.startTime} - ..."
            holder.tvTitle.text = "Session: ${item.sid}"
            val sizeKb = item.pcmData.size() / 1024
            holder.tvSubtitle.text = "$timeRange | Size: ${sizeKb}KB"

            holder.itemView.setOnClickListener { onItemClick(item) }
        }

        override fun getItemCount() = items.size
    }
}
