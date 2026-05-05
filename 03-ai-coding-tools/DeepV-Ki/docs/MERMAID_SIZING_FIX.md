# Mermaid 图表尺寸适应修复指南

## 问题描述

在 Wiki 页面首次加载时，Mermaid 图表（特别是序列图和流程图）显示尺寸过大，超出容器边界，无法完全显示。但是：

1. ✗ **首次加载时**：图表显示太大，显示不全
2. ✓ **全屏后返回**：图表自动调整为正常尺寸

这说明 Mermaid 组件的尺寸计算逻辑存在，但**页面初始加载时没有正确触发**。

## 根本原因

### 时序问题

```
页面加载开始
    ↓
React 组件渲染 Mermaid.tsx
    ↓
100ms 延迟后开始 Mermaid 渲染
    ↓
SVG 被插入到 DOM
    ↓
ResizeObserver 监听容器大小变化... (等待变化)
    ↓
页面样式计算完成 (此时尺寸可能已经锁定)
    ↓
ResizeObserver 从未被触发
    ↓
SVG 保持初始尺寸（可能过大）
```

### 关键问题

1. **ResizeObserver 只监听变化** - 不会在初始挂载时自动触发，仅当容器大小改变时才触发
2. **延迟渲染不够智能** - 固定 100ms 延迟可能不足，或无法确保容器布局已完成
3. **缺少初始化后的布局触发** - SVG 插入到 DOM 后，没有显式触发布局重新计算

当用户手动全屏时：
- 进入全屏 → 容器大小改变 → ResizeObserver 触发 → SVG 被正确调整 ✓
- 退出全屏 → 容器大小改变 → ResizeObserver 触发 → SVG 被正确调整 ✓

## 解决方案

### 1. 智能延迟渲染策略

```typescript
// 旧方式：固定 100ms
setTimeout(() => renderMermaidDiagram(), 100);

// 新方式：感知页面加载状态
if (document.readyState === 'complete') {
  // 页面已加载：使用较短延迟 (50ms)
  setTimeout(() => renderMermaidDiagram(), 50);
} else {
  // 页面还在加载：等待加载完成后再延迟 (100ms)
  window.addEventListener('load', () => {
    setTimeout(() => renderMermaidDiagram(), 100);
  });
}
```

**优势**：
- 页面已加载时不必要的等待
- 页面未加载时确保等待完成
- 减少布局冲突

### 2. SVG 插入后立即触发布局调整

```typescript
// SVG 内容设置后
setSvgContent(modifiedSvg);

// 立即触发布局重新计算
setTimeout(() => {
  const svgEl = containerRef.current?.querySelector('svg');
  if (svgEl) {
    requestAnimationFrame(() => {
      // 临时改变宽度，强制触发 ResizeObserver
      const originalWidth = svgEl.style.width;
      svgEl.style.width = (parseInt(originalWidth) - 1 || 100) + '%';

      requestAnimationFrame(() => {
        svgEl.style.width = originalWidth || '100%';
      });
    });
  }
}, 0);
```

**工作流程**：
1. SVG 被 React 插入到 DOM
2. `setTimeout(0)` 让 React 完成渲染
3. `requestAnimationFrame` 让浏览器完成布局计算
4. 临时改变 `width` 属性触发 ResizeObserver
5. ResizeObserver 回调中调整 SVG 样式
6. `requestAnimationFrame` 恢复原始宽度

### 3. 页面加载完成后的布局调整

```typescript
useEffect(() => {
  if (!containerRef.current || !isRendered) return;

  const handlePageLoad = () => {
    // requestAnimationFrame x2 确保布局完成
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const svgElement = container.querySelector('svg');
        if (svgElement) {
          // 强制重新计算布局
          const width = svgElement.offsetWidth;
          svgElement.style.width = width ? (width - 1) + 'px' : '100%';

          requestAnimationFrame(() => {
            svgElement.style.width = '100%';
          });
        }
      });
    });
  };

  if (document.readyState === 'complete') {
    handlePageLoad();
  } else {
    window.addEventListener('load', handlePageLoad);
  }

  // ResizeObserver 继续监听后续变化
  resizeObserverRef.current = new ResizeObserver(() => {
    const svgElement = container.querySelector('svg');
    if (svgElement && !isFullscreen) {
      svgElement.style.maxWidth = '100%';
      svgElement.style.height = 'auto';
    }
  });

  resizeObserverRef.current.observe(container);

  return () => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
  };
}, [isRendered, isFullscreen]);
```

## 尺寸自适应策略

Mermaid 组件根据**宽高比（aspect ratio）**采用不同的尺寸策略：

```
图表宽高比
    |
    ├─ > 2.0 : 横向图表（如序列图）
    │   └─ 策略：宽度优先，允许横向滚动
    │
    ├─ 1.2-2.0 : 较宽图表
    │   └─ 策略：填充容器宽度，最小 800px
    │
    ├─ 0.6-1.2 : 接近方形
    │   └─ 策略：填充容器宽度
    │
    └─ < 0.6 : 纵向图表（如流程图）
        └─ 策略：高度优先，限制最大高度
```

### 例子

#### 序列图（宽高比 > 2）
```
Frontend → Backend 的调用序列
█████████████████████████████ 很宽！
```
- 被设置为固定较大宽度（1000-1600px）
- 允许水平滚动

#### 流程图（宽高比 < 0.6）
```
从上到下的流程
█
█
█
█
█ 很高
█
█
█
```
- 被限制为 80% 容器宽度，最大 600px
- 限制最大高度 700px（防止太高）

## 改进效果

### 修复前
```
页面加载完成时 → SVG 插入 → ResizeObserver 无反应 → SVG 尺寸错误
                                                    ↓
                              用户全屏 → 容器改变 → ResizeObserver 触发 ✓
```

### 修复后
```
页面加载完成时 → SVG 插入 → 主动触发布局计算 → SVG 尺寸正确 ✓
                        ↓
                ResizeObserver 正确调整
                        ↓
                    显示正常 ✓
```

## 技术细节

### requestAnimationFrame 的作用

```javascript
requestAnimationFrame(() => {
  // 在浏览器下一帧执行
  // 确保：
  // 1. 所有 DOM 更新已应用
  // 2. 浏览器正在计算布局/样式
  // 3. CSS 变化已被考虑
});
```

使用 **requestAnimationFrame x2** 是为了：
1. 第一帧：让浏览器应用所有 DOM 改变
2. 第二帧：在浏览器完成布局计算后执行

### 为什么临时改变宽度？

```javascript
const originalWidth = svgEl.style.width;
svgEl.style.width = (parseInt(originalWidth) - 1 || 100) + '%';
// 这会触发 ResizeObserver（宽度改变了）

requestAnimationFrame(() => {
  svgEl.style.width = originalWidth || '100%';
  // 恢复原始宽度
});
```

这样做的目的是**强制触发 ResizeObserver**，即使容器实际大小没有改变。

## 适用场景

这个修复解决了：

✓ Wiki 页面首次加载时 Mermaid 图表尺寸错误
✓ 刷新页面后 Mermaid 图表显示不全
✓ 复杂的序列图和流程图显示问题
✓ 移动设备响应式调整问题

## 相关文件

- `src/components/Mermaid.tsx` - 核心修复
- `src/components/WikiMarkdownViewer.tsx` - Mermaid 使用方

## 测试建议

1. **首次加载测试**
   - 打开 Wiki 页面
   - 检查 Mermaid 图表是否正确显示（不超出边界）

2. **多个图表测试**
   - 包含多个 Mermaid 图表的 Wiki
   - 确保每个图表都正确调整

3. **响应式测试**
   - 调整浏览器窗口大小
   - Mermaid 图表应该跟随容器大小变化

4. **全屏测试**
   - 点击全屏按钮
   - 退出全屏
   - 确保两个状态下尺寸都正确

5. **长页面测试**
   - 包含多个部分和多个 Mermaid 图表
   - 向下滚动
   - 所有图表应该正确显示
