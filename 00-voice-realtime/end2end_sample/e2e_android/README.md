# Robot Navigation Bridge - WebView桥接项目

## 📋 项目简介

这是一个Android WebView桥接项目，将OrionStar机器人的RobotAPI地图导航功能暴露给JavaScript，使得网页应用可以通过JavaScript API控制机器人的导航功能。

## ✨ 主要功能

### 已桥接的8个核心导航API：

1. **isRobotEstimate** - 判断当前是否已定位
2. **getPosition** - 获取机器人当前坐标点
3. **getLocation** - 根据位置名称获取坐标点
4. **setLocation** - 设置当前位置名称（设点）
5. **getPlaceList** - 获取当前地图所有位置点
6. **getMapName** - 获取当前地图名称
7. **startNavigation** - 开始导航到指定位置
8. **stopNavigation** - 停止导航

### 额外功能：
- ✅ WebView支持摄像头权限
- ✅ WebView支持麦克风/语音权限
- ✅ 独立的JavaScript SDK文件（可供其他项目使用）
- ✅ 完整的示例HTML页面
- ✅ 导航状态实时回调

## 🏗️ 项目架构

```
e2e_android/
├── app/
│   ├── libs/                          # JAR包目录
│   │   └── robotservice_xx.jar        # 需要手动放置RobotService SDK
│   ├── src/main/
│   │   ├── assets/                    # Web资源文件
│   │   │   ├── robot-navigation-sdk.js   # JavaScript SDK（可独立使用）
│   │   │   └── index.html                # 示例HTML页面
│   │   ├── java/com/e2e/orionstar/
│   │   │   ├── MainActivity.kt           # 主Activity（WebView配置）
│   │   │   └── bridge/
│   │   │       └── RobotNavigationBridge.kt  # Android桥接类
│   │   ├── AndroidManifest.xml        # 权限配置
│   │   └── res/                       # Android资源
│   └── build.gradle.kts               # 构建配置
└── README.md                          # 本文件
```

## 🚀 快速开始

### 1. 前置要求

- Android Studio Arctic Fox 或更高版本
- JDK 11
- Android SDK API 24+
- RobotService SDK（robotservice_xx.jar）

### 2. 安装步骤

#### 步骤1：获取RobotService SDK
从机器人系统目录获取`robotservice_xx.jar`文件（例如：Robot/v11.3C/robotservice_11.3.jar）

#### 步骤2：放置JAR包
将JAR包复制到项目的`app/libs/`目录：
```bash
cp /path/to/robotservice_11.3.jar app/libs/
```

#### 步骤3：同步项目
在Android Studio中打开项目，点击 `Sync Project with Gradle Files`

#### 步骤4：编译运行
连接机器人设备或使用模拟器，点击运行按钮

### 3. 部署到机器人

1. 通过USB连接机器人
2. 在Android Studio中选择设备
3. 点击运行按钮安装应用
4. 首次运行会请求权限（摄像头、麦克风等），请全部允许

### 4. 配置开机启动（可选）

如需应用开机自动启动：
1. 三指下拉进入机器人系统设置
2. 选择"开发者设置"
3. 在"开机启动程序"中配置本应用

## 📱 使用方式

### 方式一：使用内置示例页面

应用启动后会自动加载`index.html`示例页面，提供完整的UI控制界面。

### 方式二：加载自定义网页

修改`MainActivity.kt`中的URL：
```kotlin
private const val DEFAULT_URL = "https://your-web-app.com"
```

或通过Intent传递URL：
```kotlin
val intent = Intent(this, MainActivity::class.java)
intent.putExtra("url", "https://your-web-app.com")
startActivity(intent)
```

### 方式三：在其他项目中使用JavaScript SDK

#### 复制SDK文件
将`app/src/main/assets/robot-navigation-sdk.js`复制到您的Web项目中

#### 在HTML中引入
```html
<script src="robot-navigation-sdk.js"></script>
```

#### 使用API
```javascript
// 全局对象：RobotNavSDK

// 1. 检查定位状态
const isEstimated = await RobotNavSDK.isRobotEstimate();

// 2. 获取当前位置
const position = await RobotNavSDK.getPosition();
console.log(position); // { x: 1.5, y: 2.3, theta: 0.5 }

// 3. 获取位置点列表
const places = await RobotNavSDK.getPlaceList();

// 4. 设置导航状态回调
RobotNavSDK.setNavigationStatusCallback((status) => {
    console.log('导航状态:', status.message);
});

// 5. 开始导航
await RobotNavSDK.startNavigation('接待点');

// 6. 停止导航
await RobotNavSDK.stopNavigation();
```

## 📖 API文档

### JavaScript SDK API

#### 1. isRobotEstimate()
判断机器人是否已定位
```javascript
const isEstimated = await RobotNavSDK.isRobotEstimate();
// 返回: boolean
```

#### 2. getPosition()
获取机器人当前坐标
```javascript
const position = await RobotNavSDK.getPosition();
// 返回: { x: number, y: number, theta: number }
```

#### 3. getLocation(placeName)
根据名称获取位置点坐标
```javascript
const location = await RobotNavSDK.getLocation('接待点');
// 返回: { exist: boolean, name: string, x?: number, y?: number, theta?: number }
```

#### 4. setLocation(placeName)
保存当前位置为新的位置点
```javascript
const result = await RobotNavSDK.setLocation('新位置点');
// 返回: { placeName: string, message: string }
```

#### 5. getPlaceList()
获取当前地图的所有位置点
```javascript
const places = await RobotNavSDK.getPlaceList();
// 返回: Array<{ name, x, y, theta, id, time, status }>
// status: 0=可达, 1=禁行, 2=地图外
```

#### 6. getMapName()
获取当前地图名称
```javascript
const mapName = await RobotNavSDK.getMapName();
// 返回: string
```

#### 7. startNavigation(placeName)
开始导航到指定位置
```javascript
const result = await RobotNavSDK.startNavigation('目的地');
// 返回: { status, message, statusCode, destination }
```

#### 8. stopNavigation()
停止当前导航
```javascript
const result = await RobotNavSDK.stopNavigation();
// 返回: { success: boolean, message: string }
```

#### 9. setNavigationStatusCallback(callback)
设置导航状态回调（接收导航过程中的状态更新）
```javascript
RobotNavSDK.setNavigationStatusCallback((status) => {
    console.log(status.message);
    // status: { status: number, message: string, data?, extraData? }
});
```

### 导航状态码说明

#### 成功状态
- `1` - 导航成功
- `102` - 已到达目的地
- `3` - 导航已停止

#### 过程状态
- `1014` - 导航开始
- `1045` - 定位丢失
- `1018` - 避障
- `1019` - 避障结束
- `1050` - 距目的地距离（extraData包含距离值）

#### 错误状态
- `-116` - 机器人未定位
- `-108` - 目的地不存在
- `-113` - 已经在目的地
- `-109` - 目的地不可达
- `-136` - 避障超时

## 🔧 开发说明

### 添加新的桥接API

#### 1. 在RobotNavigationBridge.kt中添加方法
```kotlin
fun yourNewMethod(param: String, callbackName: String) {
    if (!checkConnection(callbackName)) return

    val reqId = reqIdGenerator.incrementAndGet()
    RobotApi.getInstance().yourRobotApiMethod(reqId, param, object : CommandListener() {
        override fun onResult(result: Int, message: String?) {
            val response = JSONObject().apply {
                put("success", true)
                put("data", message)
            }
            invokeJsCallback(callbackName, response.toString())
        }
    })
}
```

#### 2. 在MainActivity.kt中暴露方法
```kotlin
@android.webkit.JavascriptInterface
fun yourNewMethod(param: String, callbackName: String) {
    bridge.yourNewMethod(param, callbackName)
}
```

#### 3. 在robot-navigation-sdk.js中添加封装
```javascript
async yourNewMethod(param) {
    return this._callNative('yourNewMethod', param);
}
```

### WebView调试

启用Chrome远程调试：
```kotlin
// 在MainActivity的onCreate中添加
if (BuildConfig.DEBUG) {
    WebView.setWebContentsDebuggingEnabled(true)
}
```

然后在Chrome中访问：`chrome://inspect`

## 📝 注意事项

1. **权限管理**：首次运行需要授予所有权限（摄像头、麦克风、存储等）
2. **RobotAPI连接**：应用启动时会自动连接RobotAPI，需要在机器人系统上运行
3. **定位要求**：导航功能需要机器人已完成定位
4. **线程安全**：所有JavaScript回调都在主线程执行
5. **内存管理**：页面卸载时SDK会自动清理回调，避免内存泄漏

## 🐛 常见问题

### Q: 应用安装后无法连接RobotAPI
A: 确保应用运行在机器人系统上，并且RobotService正常运行

### Q: JavaScript调用没有响应
A: 检查WebView的JavaScript是否已启用，查看Logcat日志

### Q: 权限请求被拒绝
A: 在系统设置中手动授予应用权限，或重新安装应用

### Q: 导航无法启动
A: 确保机器人已定位，目的地点位已存在且可达

### Q: 如何查看JavaScript控制台日志
A: 使用Chrome远程调试（chrome://inspect）或查看Android Logcat

## 📄 许可证

本项目仅供学习和开发使用。RobotService SDK版权归OrionStar所有。

## 👥 维护者

E2E Development Team

## 📞 支持

如有问题，请查阅：
- [RobotAPI官方文档](RobotAPI.md)
- Android Logcat日志
- Chrome DevTools远程调试

---

**最后更新**: 2025-11-19
**版本**: 1.0.0
