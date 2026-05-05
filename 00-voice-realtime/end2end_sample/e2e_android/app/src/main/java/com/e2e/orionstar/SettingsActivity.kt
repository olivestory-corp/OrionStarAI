package com.e2e.orionstar

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.e2e.orionstar.base.BaseGestureActivity
import com.e2e.orionstar.ui.theme.E2EModelTheme

/**
 * 设置Activity - 配置应用参数
 */
class SettingsActivity : BaseGestureActivity() {

    companion object {
        private const val PREFS_NAME = "app_settings"
        private const val KEY_WEB_URL = "web_url"

        /**
         * 获取保存的URL，如果没有则返回默认值
         */
        fun getSavedUrl(context: android.content.Context): String {
            val prefs = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            return prefs.getString(KEY_WEB_URL, BuildConfig.WEB_URL) ?: BuildConfig.WEB_URL
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            E2EModelTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SettingsScreen()
                }
            }
        }
    }

    @Composable
    fun SettingsScreen() {
        val context = LocalContext.current
        val prefs = context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        // 获取当前保存的URL
        var urlText by remember {
            mutableStateOf(TextFieldValue(prefs.getString(KEY_WEB_URL, BuildConfig.WEB_URL) ?: BuildConfig.WEB_URL))
        }

        var showSuccessDialog by remember { mutableStateOf(false) }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 标题
            Text(
                text = "应用设置",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.padding(vertical = 24.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // URL输入框
            OutlinedTextField(
                value = urlText,
                onValueChange = { urlText = it },
                label = { Text("WebView加载URL") },
                placeholder = { Text("例如: https://example.com/") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = false,
                maxLines = 3,
                supportingText = {
                    Text("请输入完整的URL地址，包括协议（http://或https://）")
                }
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 显示默认URL提示
            Text(
                text = "默认URL: ${BuildConfig.WEB_URL}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(32.dp))

            // 保存按钮
            Button(
                onClick = {
                    // 保存URL到SharedPreferences
                    prefs.edit().apply {
                        putString(KEY_WEB_URL, urlText.text.trim())
                        apply()
                    }
                    showSuccessDialog = true
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("保存设置", style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 重置按钮
            OutlinedButton(
                onClick = {
                    urlText = TextFieldValue(BuildConfig.WEB_URL)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("重置为默认", style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 启动应用按钮
            FilledTonalButton(
                onClick = {
                    // 启动MainActivity
                    val intent = Intent(context, MainActivity::class.java)
                    intent.putExtra("url", prefs.getString(KEY_WEB_URL, BuildConfig.WEB_URL))
                    startActivity(intent)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("启动应用", style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // VAD测试按钮
            OutlinedButton(
                onClick = {
                    // 启动VadTestActivity
                    val intent = Intent(context, VadTestActivity::class.java)
                    startActivity(intent)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text("VAD测试", style = MaterialTheme.typography.titleMedium)
            }

            Spacer(modifier = Modifier.weight(1f))

            // 版本信息
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(vertical = 16.dp)
            ) {
                Text(
                    text = "版本 ${BuildConfig.VERSION_NAME}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Build ${BuildConfig.VERSION_CODE}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // 成功保存对话框
        if (showSuccessDialog) {
            AlertDialog(
                onDismissRequest = { showSuccessDialog = false },
                title = { Text("保存成功") },
                text = { Text("URL配置已保存，点击\"启动应用\"使用新配置") },
                confirmButton = {
                    TextButton(onClick = { showSuccessDialog = false }) {
                        Text("确定")
                    }
                }
            )
        }
    }
}
