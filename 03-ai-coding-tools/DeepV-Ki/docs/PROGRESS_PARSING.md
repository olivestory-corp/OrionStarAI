# 进度解析系统文档

## 概述

前端现在能够从后端返回的消息中智能解析真实的 Wiki 生成进度。当后端返回类似 `"Generating page 3/13: 架构概览"` 的消息时，前端会自动提取 `3/13` 并重新校对进度条。

## 功能说明

### 进度消息格式

后端返回的任务状态包含 `message` 字段，当生成页面时，格式如下：

```
"Generating page x/y: [page_title]"
```

例如：
- `"Generating page 1/13: 架构概览"`
- `"Generating page 3/13: API 文档"`
- `"Generating page 13/13: 贡献指南"`

### 进度计算策略

采用**分阶段进度分配**策略：

| 阶段 | 进度范围 | 说明 |
|------|--------|------|
| 准备工作 | 0-10% | 初始化、代码克隆、文本提取 |
| **页面生成** | **10-90%** | **基于已生成页面数占总页数的比例** |
| 后处理 | 90-99% | 图表渲染、缓存写入 |
| 完成 | 100% | 任务完成 |

#### 计算公式

当消息中包含 `"Generating page x/y"` 时：

```
Page Progress = (x / y) * 100
Display Progress = 10 + (Page Progress / 100) * 80
```

**示例**：
- 页面 1/11：10 + (1/11) * 80 ≈ **17%**
- 页面 5/11：10 + (5/11) * 80 ≈ **46%**
- 页面 11/11：10 + (11/11) * 80 = **90%**

### 进度条更新流程

```
后端返回消息
    ↓
前端解析 "Generating page x/y"
    ↓
提取 x 和 y
    ↓
计算页面百分比 (x/y)*100
    ↓
应用分阶段公式：10 + (percentage/100)*80
    ↓
确保单调性：进度不会后退
    ↓
更新进度条显示
```

## 实现细节

### 核心模块：`src/lib/progress-parser.ts`

#### `parseProgressMessage(message: string): ParsedProgress`

解析消息字符串，提取页面进度信息。

**返回值**：
```typescript
{
  currentPage?: number;    // 当前页号 (x)
  totalPages?: number;     // 总页数 (y)
  pagePercentage?: number; // 页面百分比 (0-100)
  message: string;         // 原始消息
}
```

**示例**：
```typescript
const result = parseProgressMessage('Generating page 3/13: 架构概览');
// {
//   currentPage: 3,
//   totalPages: 13,
//   pagePercentage: 23,
//   message: 'Generating page 3/13: 架构概览'
// }
```

#### `calculateSmartProgress(apiProgress, message, lastProgress): number`

综合多个进度信号，计算最终显示的进度。

**逻辑**：
1. 如果消息中有页面进度，使用页面进度作为真实进度
2. 否则使用 API 返回的进度值
3. 确保进度单调增加（不会后退）

**参数**：
- `apiProgress`: API 返回的进度值 (0-100)
- `message`: 后端消息文本
- `lastProgress`: 上一次计算的进度（用于确保单调性）

**返回值**: 最终显示的进度 (0-100)

### Hook 集成：`src/hooks/useTasks.ts`

在轮询任务状态时，自动应用进度解析：

```typescript
const pollTaskStatus = useCallback(async (taskId: string) => {
  const data = await fetchTaskStatus(taskId);

  // 解析并计算真实进度
  const smartProgress = calculateSmartProgress(
    data.progress,
    data.message,
    lastProgressRef.current
  );

  // 更新任务状态
  setTask({
    ...data,
    progress: smartProgress,
    pages_generated: parsedProgress.currentPage,
    pages_total: parsedProgress.totalPages,
  });
}, []);
```

### 组件应用：`src/components/project/ProjectWikiStatus.tsx`

在项目状态组件中显示解析的进度：

```typescript
const progress = calculateProgress(status);
// 使用 parseProgressMessage 解析消息
// 显示进度条：10-90% 范围内
```

## 进度条示例

### 场景 1：生成 13 页的全面型 Wiki

```
消息: "Generating page 1/13: 架构概览"
计算: 10 + (1/13)*80 = 10 + 6.15 ≈ 16%
显示: ████░░░░░░░░░░░░░░░░░░░░░░ 16%

消息: "Generating page 7/13: API 参考"
计算: 10 + (7/13)*80 = 10 + 43.08 ≈ 53%
显示: █████████████░░░░░░░░░░░░░░░ 53%

消息: "Generating page 13/13: 贡献指南"
计算: 10 + (13/13)*80 = 90%
显示: ██████████████████████████░░ 90%
```

### 场景 2：简洁型 Wiki (6 页)

```
消息: "Generating page 1/6: 快速开始"
计算: 10 + (1/6)*80 = 10 + 13.33 ≈ 23%
显示: ██████░░░░░░░░░░░░░░░░░░░░░ 23%

消息: "Generating page 6/6: 常见问题"
计算: 10 + (6/6)*80 = 90%
显示: ██████████████████████████░░ 90%
```

## 确保单调性

进度条永远不会后退，即使后端返回了较低的页面号：

```typescript
// 场景：前一次轮询显示 page 5/13 → 53%
lastProgress = 53;

// 本次轮询返回 page 4/13（某些原因）→ 43%
const smartProgress = calculateSmartProgress(
  apiProgress,      // 来自 API
  'Generating page 4/13: ...',
  lastProgress      // 53% (前一次)
);
// 结果：max(43, 53) = 53% （保持不变或增加，不会减少）
```

## 测试

测试用例位于 `src/lib/progress-parser.test.ts`，覆盖：
- 标准 "Generating page x/y" 格式解析
- 不同间距的格式处理
- 大小写敏感性
- 边界情况 (page 0, page 1/1 等)
- 单调性保证
- API 进度与页面进度的优先级

## 使用场景

### 场景 1：任务详情页面

任务详情页面显示真实的页面生成进度：

```
状态：⚙️ Running

Progress: 56%
████████████████████░░░░░░░░░░░░░░░░░░

Current Stage: Pages
Generating page 7/13: API 参考

Pages Generation
7 / 13 pages generated
████████████████░░░░░░░░░░░░░░░░░░░░░░
```

### 场景 2：项目卡片进度

项目卡片显示生成中的进度，使用相同的计算方式：

```
生成中 ⚙️

████████░░░░░░░░░░░░░░░░░░░░ 32%
Generating page 3/11: 快速开始
```

## 常见问题

### Q: 为什么页面进度只能到 90%？

A: 因为在生成完所有页面后，还需要进行后处理（图表渲染、缓存、索引生成等），这部分工作占用 10-99%（实际上最后 1% 是完成标志）。

### Q: 如果后端没有发送 "Generating page x/y" 消息呢？

A: 前端会回退到使用 API 返回的 `progress` 字段。如果 API 也没有提供，默认显示 5%。

### Q: 进度条会一直跳动吗？

A: 不会。由于我们实现了单调性保证，进度只会增加或保持不变，不会后退。

### Q: 两种 Wiki 类型的进度差异是什么？

A: 计算方式相同。简洁型可能页数较少（4-6 页），全面型较多（8-12 页），但进度百分比计算方式一致。

## 相关文件

- `src/lib/progress-parser.ts` - 核心解析逻辑
- `src/lib/progress-parser.test.ts` - 单元测试
- `src/hooks/useTasks.ts` - Hook 集成
- `src/components/project/ProjectWikiStatus.tsx` - 组件应用
- `src/app/tasks/[taskId]/page.tsx` - 任务详情页面
