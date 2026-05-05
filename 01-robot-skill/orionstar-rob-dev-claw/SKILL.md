---
name: rob-apk-dev
description: 猎户星空机器人 APK 二开开发指南。包含 AgentOS SDK 文档、RobotAPI 文档、robotservice.jar 路径、Android Studio 开发环境配置。当需要：新建机器人 APK 项目、集成 AgentOS SDK、注册 Action、调用 RobotAPI（导航/运动/人脸/底盘）、配置 ADB 调试、Android 环境配置、AppAgent/PageAgent 开发 等任务时使用此 skill。
---

# 猎户星空机器人 APK 二开 Skill

## 技术栈概述

猎户星空机器人 APK 二开使用两套 SDK 协同工作：
- **AgentOS SDK**：负责 AI 交互（语音、大模型、Action 规划），项目 package `com.ainirobot.agent`
- **RobotAPI (robotservice.jar)**：负责硬件控制（导航、运动、人脸识别、底盘、灯效），package `com.ainirobot.coreservice`

> **重要**：语音（ASR/TTS/NLP/唤醒）已完全迁移至 AgentOS SDK，RobotAPI 的语音功能已停用。

## 开发环境配置

### 1. 工具链要求
- Android Studio（最新稳定版）
- JDK 11
- Android SDK API 26+（minSdk = 26）
- ADB（Android Debug Bridge）

### 2. ADB 连接机器人

```bash
# 通过 WiFi 连接
adb connect <机器人IP>:5555

# 安装 APK
adb install -r app-debug.apk

# 查看日志（替换包名）
adb logcat --pid=$(adb shell pidof com.your.package) -v time

# 开启 TCP 调试（如果机器人默认未开启）
adb shell setprop service.adb.tcp.port 5555
adb shell stop adbd && adb shell start adbd
```

## AgentOS SDK 集成

### Maven 仓库配置（settings.gradle.kts）

```kotlin
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
        maven {
            credentials.username = "agentMaven"
            credentials.password = "agentMaven"
            url = uri("https://npm.ainirobot.com/repository/maven-public/")
        }
    }
}
```

### 依赖（app/build.gradle.kts）

```kotlin
dependencies {
    implementation("com.orionstar.agent:sdk:0.4.5-SNAPSHOT")  // v0.4.4+ 已内置 RobotService
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
}
```

> v0.4.4 起，SDK 已通过 Maven 自动管理 robotservice.jar，**无需手动添加 jar**。

### actionRegistry.json（必须，放在 app/src/main/assets/）

```json
{
  "appId": "app_ebbd1e6e22d6499eb9c220daf095d465",
  "platform": "apk",
  "actionList": []
}
```

### AndroidManifest.xml 权限

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="com.ainirobot.coreservice.robotSettingProvider" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>

<!-- 开机自启（可选） -->
<activity android:name=".MainActivity">
    <intent-filter>
        <action android:name="action.orionstar.default.app" />
        <category android:name="android.intent.category.DEFAULT" />
    </intent-filter>
</activity>
```

## AgentOS SDK 核心 API 速查

详细 API 文档参见 [references/agentos-sdk.md](references/agentos-sdk.md)

### 最常用模式

```kotlin
// MainApplication.kt
class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        object : AppAgent(this) {
            override fun onCreate() {
                setPersona("你是...")
                setObjective("你的目标是...")
            }
            override fun onExecuteAction(action: Action, params: Bundle?) = false
        }
    }
}

// MainActivity.kt
PageAgent(this)
    .registerAction(Action(
        name = "com.xxx.ACTION_NAME",
        displayName = "显示名",
        desc = "触发时机描述",
        parameters = emptyList(),
        executor = object : ActionExecutor {
            override fun onExecute(action: Action, params: Bundle?): Boolean {
                AOCoroutineScope.launch {
                    AgentCore.ttsSync("...")
                    action.notify(isTriggerFollowUp = false)
                }
                return true
            }
        }
    ))
```

## RobotAPI (robotservice_11.3.jar)

**jar 文件**：`assets/robotservice_11.3.jar`（复制到项目 `app/libs/` 目录使用）

```kotlin
// build.gradle.kts 中添加（仅在使用老版本 SDK 时需要手动添加）
implementation(files("libs/robotservice_11.3.jar"))
```

> v0.4.4+ AgentOS SDK 已内置，通常无需手动添加。

详细 RobotAPI 文档参见 [references/robot-api.md](references/robot-api.md)

### 连接 RobotAPI

```java
RobotApi.getInstance().connectServer(this, new ApiListener() {
    @Override public void handleApiConnected() { /* 连接成功，可调 API */ }
    @Override public void handleApiDisconnected() { /* 断开 */ }
    @Override public void handleApiDisabled() { /* 禁用 */ }
});
```

### 常用 RobotAPI 速查

```java
// 导航到点位
RobotApi.getInstance().startNavigation(reqId, destName, 0.2f, 30000, listener);

// 停止导航
RobotApi.getInstance().stopNavigation(reqId);

// 头部运动
RobotApi.getInstance().moveHead(reqId, "absolute", "absolute", hAngle, vAngle, listener);

// 前进
RobotApi.getInstance().goForward(reqId, 0.5f, listener);

// 人脸检测
List<Person> persons = PersonApi.getInstance().getAllPersons();
```

## 详细文档索引

- **[开发环境配置](references/dev-setup.md)**：Android Studio 安装、Gradle 模板、常用 ADB 命令、调试技巧
- **[AgentOS SDK 完整文档](references/agentos-sdk.md)**：v0.4.5，包含 Action、TTS、LLM、麦克风、PageAgent/AppAgent 等所有 API
- **[RobotAPI 完整文档](references/robot-api.md)**：v11.3，包含导航、运动、人脸识别、底盘、灯效、电量等所有 API
