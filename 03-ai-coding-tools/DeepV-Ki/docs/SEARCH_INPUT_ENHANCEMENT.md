# 搜索框和输入框样式优化指南

## 优化概述

为了提升用户体验和视觉吸引力，对前端的搜索框和问题输入框进行了全面优化。改进涵盖**焦点状态、阴影效果、颜色对比、交互反馈**等多个方面。

## 优化内容

### 1. ProjectList 搜索框 (`src/components/project/ProjectList.tsx`)

#### 改进前
```html
<!-- 简单的输入框，焦点状态不够明显 -->
<input
  type="text"
  placeholder="搜索项目..."
  className="w-full pl-11 pr-10 py-3 rounded-lg border border-gray-300
             focus:ring-2 focus:ring-emerald-500"
/>
```

#### 改进后
```html
<!-- 多层次的视觉反馈 -->
<div className="relative group">
  <!-- 背景光晕效果：焦点时显示彩色光晕 -->
  <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/20
                  to-[var(--accent-secondary)]/20 rounded-xl blur-xl
                  opacity-0 group-focus-within:opacity-100 transition-opacity" />

  <!-- 增强的边框和阴影：hover 和 focus 状态都有视觉反馈 -->
  <div className="relative ... border-2 border-gray-200 hover:border-[var(--accent-primary)]/50
                  focus-within:border-[var(--accent-primary)]
                  shadow-sm hover:shadow-md focus-within:shadow-lg">
    <!-- 图标缩放：焦点时放大 -->
    <FaSearch className="text-[var(--accent-primary)] ... group-focus-within:scale-110" />
    <input ... className="flex-1 bg-transparent" />
    <!-- 清除按钮增强：hover 时放大和变色 -->
    <button className="hover:text-[var(--accent-primary)] hover:scale-110
                       hover:bg-gray-100" />
  </div>
</div>
```

#### 主要改进
| 特性 | 改进方案 |
|------|--------|
| 焦点状态 | 添加渐变光晕 + 边框加粗 + 阴影增强 |
| 颜色对比 | 图标和按钮使用品牌色（accent-primary） |
| 交互反馈 | Hover 时显示边框颜色变化、阴影增强 |
| 视觉层级 | 使用 3 个渐进层次：未焦点 → Hover → 焦点 |
| 边框设计 | 从 1px 升级到 2px，使用圆角半径 (rounded-xl) |

### 2. ProcessedProjects 搜索框 (`src/components/ProcessedProjects.tsx`)

#### 改进内容
- 使用与 ProjectList 相同的视觉设计系统
- 集成到项目的 CSS 变量系统（`--accent-primary`、`--border-color` 等）
- 增加 SVG 搜索图标动画（焦点时缩放）
- 改进清除按钮的交互体验

#### 代码结构
```html
<div className="relative flex-1 group">
  <!-- 光晕背景 -->
  <div className="absolute inset-0 bg-gradient-to-r ... group-focus-within:opacity-100" />

  <!-- 输入框容器 -->
  <div className="relative bg-[var(--background)] rounded-xl border-2
                  border-[var(--border-color)] hover:border-[var(--accent-primary)]/50
                  focus-within:border-[var(--accent-primary)]">
    <div className="flex items-center gap-3 px-4 py-3.5">
      <!-- SVG 搜索图标 -->
      <svg className="w-5 h-5 text-[var(--accent-primary)]
                      group-focus-within:scale-110" />
      <input className="flex-1 bg-transparent" />
      <!-- 清除按钮 -->
      {searchQuery && <button className="hover:scale-110 ..." />}
    </div>
  </div>
</div>
```

### 3. Ask 组件问题输入框 (`src/components/Ask.tsx`)

#### 改进前
```html
<textarea
  placeholder="询问关于这个代码库的任何问题..."
  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200
             focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
/>
```

#### 改进后
```html
<div className="relative group">
  <!-- 蓝紫色渐变光晕：更符合 Ask 功能的调性 -->
  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20
                  to-purple-500/20 rounded-xl blur-lg
                  opacity-0 group-focus-within:opacity-100" />

  <!-- 增强的视觉容器 -->
  <div className="relative ... border-2 border-slate-200
                  hover:border-blue-400 focus-within:border-blue-500
                  shadow-sm hover:shadow-md focus-within:shadow-lg
                  focus-within:shadow-blue-500/20">
    <textarea className="w-full px-4 py-3 pr-12 bg-transparent" />
    <!-- 发送按钮增强 -->
    <button className="p-2 rounded-lg hover:scale-110
                       hover:bg-blue-50 dark:hover:bg-blue-900/20" />
  </div>
</div>
```

#### 设计特点
- **颜色方案**：蓝紫色渐变，与问答功能相匹配
- **尺寸**：保持原有高度，但更显眼
- **交互**：按钮有 scale 动画，提升反馈感
- **发光效果**：焦点时显示蓝色发光阴影

## 设计原则

### 1. 递进式视觉反馈
```
未焦点状态
├─ 静态边框（灰色）
├─ 静态阴影（sm）
└─ 静态图标颜色

↓ Hover 状态 ↓

Hover 状态
├─ 边框变浅（半透明品牌色）
├─ 阴影增强（md）
└─ 图标颜色不变

↓ 焦点状态 ↓

焦点状态
├─ 边框加粗 + 品牌色
├─ 阴影最强 + 发光色 (lg + shadow)
├─ 光晕显示（渐变背景 blur）
├─ 图标缩放 (scale-110)
└─ 清除按钮显示/增强
```

### 2. 一致的交互反馈
所有输入相关元素都支持：
- **Hover**：边框颜色变化 + 阴影增强
- **Focus**：边框加粗 + 光晕出现 + 图标动画
- **Clear/Submit**：按钮 scale + 颜色变化

### 3. 暗色模式支持
```css
/* 浅色模式 */
border-gray-300, border-slate-200
hover:border-[var(--accent-primary)]/50
focus:border-[var(--accent-primary)]

/* 深色模式 */
dark:border-gray-700, dark:border-slate-700
dark:hover:border-[var(--accent-primary)]/40
dark:focus:border-[var(--accent-primary)]
```

## 视觉效果展示

### 搜索框三态变化

```
状态 1: 未焦点（静态）
┌─────────────────────────────────┐
│ 🔍 搜索项目名、路径或描述...       │
└─────────────────────────────────┘

状态 2: Hover（增强）
┌─────────────────────────────────┐
│ 🔍 搜索项目名、路径或描述...       │ 📍 边框变蓝
└─────────────────────────────────┘ 📍 阴影加强

状态 3: 焦点（完整反馈）
    ✨ 光晕效果 ✨
┌─────────────────────────────────┐
│ 🔍(↑) 搜索项目名、路径或描述...  ✕ │ 📍 边框品牌色
└─────────────────────────────────┘ 📍 强阴影 + 发光
    ✨ 光晕效果 ✨
```

### 输入框尺寸参考

| 组件 | 高度 | 内边距 | 边框 | 圆角 |
|------|------|--------|------|------|
| 搜索框 | auto (flex) | px-4 py-3.5 | 2px | rounded-xl |
| 问题框 | auto (textarea) | px-4 py-3 | 2px | rounded-xl |
| 清除按钮 | 32px | p-1 | 0 | rounded-lg |
| 发送按钮 | 32px | p-2 | 0 | rounded-lg |

## Tailwind 类名说明

### 新增的关键类名

```tailwind
/* 边框和阴影 */
border-2              /* 2px 边框（比默认 1px 更显眼） */
hover:border-[...]    /* Hover 时边框颜色 */
focus-within:border-[...] /* 容器内有焦点元素时边框 */

shadow-sm             /* 小阴影 - 正常状态 */
hover:shadow-md       /* 中阴影 - Hover 状态 */
focus-within:shadow-lg /* 大阴影 - 焦点状态 */
focus-within:shadow-[...]/20 /* 发光阴影 - 焦点状态 */

/* 动画和过渡 */
transition-all        /* 平滑过渡所有变化 */
duration-200          /* 200ms 过渡时间 */
duration-300          /* 300ms 过渡时间（光晕） */

/* 图标动画 */
group-focus-within:scale-110  /* 焦点时放大 */
hover:scale-110               /* Hover 时放大 */

/* 背景光晕 */
bg-gradient-to-r from-[...]/20 to-[...]/20 /* 渐变背景 */
rounded-xl blur-xl            /* 模糊光晕 */
opacity-0 group-focus-within:opacity-100 /* 焦点时显示 */
```

## 使用建议

### 何时使用此样式
✅ 主要搜索框（项目列表、文档搜索）
✅ 重要输入框（问题框、配置输入）
✅ 需要高可见性的输入元素

### 何时使用简化版本
⚠️ 次级搜索框（表格过滤）
⚠️ 嵌入式输入（侧边栏、模态框）

### 自定义颜色
```tsx
// ProjectList - 使用项目品牌色
from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20

// Ask - 使用蓝紫色
from-blue-500/20 to-purple-500/20

// 自定义 - 使用特定颜色
from-green-500/20 to-emerald-500/20
```

## 无障碍考虑

✓ 焦点状态明显（边框 + 阴影 + 光晕）
✓ 颜色对比充足（品牌色 + 白色背景）
✓ 清除/发送按钮可访问（title 属性）
✓ 暗色模式支持（完整的 dark: 类）

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| CSS Grid/Flex | ✓ | ✓ | ✓ | ✓ |
| Focus-within | ✓ | ✓ | ✓ | ✓ |
| backdrop-filter (可选) | ✓ | ✓ | ✓ | ✓ |
| Tailwind v4 | ✓ | ✓ | ✓ | ✓ |

## 相关文件

- `src/components/project/ProjectList.tsx` - 项目列表搜索框
- `src/components/ProcessedProjects.tsx` - 已处理项目搜索框
- `src/components/Ask.tsx` - 问题输入框
- `src/app/globals.css` - CSS 变量定义

## 性能影响

✓ **零性能影响** - 仅使用 CSS 和 Tailwind 类
✓ **过渡动画优化** - 使用 GPU 加速属性（transform, opacity）
✓ **无额外 JavaScript** - 纯 CSS 实现所有效果
