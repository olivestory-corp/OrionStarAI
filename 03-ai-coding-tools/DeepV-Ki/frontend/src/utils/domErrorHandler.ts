/**
 * DOM 操作容错处理工具
 *
 * 用于处理 React 18 中由于异步渲染导致的 DOM 操作错误
 * 特别是处理 removeChild 时目标节点不是子节点的问题
 */

/**
 * 安全地从父元素中移除子节点
 */
export function safeRemoveChild(parent: Node | null, child: Node | null): boolean {
  try {
    if (!parent || !child) return false;

    // 检查是否真的是子节点
    if (parent.contains(child)) {
      parent.removeChild(child);
      return true;
    }

    return false;
  } catch (error) {
    console.warn('safeRemoveChild error:', error);
    return false;
  }
}

/**
 * 安全地向父元素添加子节点
 */
export function safeAppendChild(parent: Node | null, child: Node | null): boolean {
  try {
    if (!parent || !child) return false;

    parent.appendChild(child);
    return true;
  } catch (error) {
    console.warn('safeAppendChild error:', error);
    return false;
  }
}

/**
 * 安全地清空元素的所有子节点
 */
export function safeClearChildren(element: Element | null): boolean {
  try {
    if (!element) return false;

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    return true;
  } catch (error) {
    console.warn('safeClearChildren error:', error);
    // 降级方案：使用 innerHTML
    try {
      if (element) {
        element.innerHTML = '';
      }
      return true;
    } catch (innerError) {
      console.warn('safeClearChildren fallback failed:', innerError);
      return false;
    }
  }
}

/**
 * 安全地设置元素内容
 * 优先使用 textContent，避免 XSS，必要时使用 innerHTML
 */
export function safeSetContent(
  element: Element | null,
  content: string,
  isHtml: boolean = false
): boolean {
  try {
    if (!element) return false;

    if (isHtml) {
      element.innerHTML = content;
    } else {
      element.textContent = content;
    }

    return true;
  } catch (error) {
    console.warn('safeSetContent error:', error);
    return false;
  }
}

/**
 * 安全地在参考节点之前插入新节点
 */
export function safeInsertBefore(
  parent: Node | null,
  newNode: Node | null,
  referenceNode: Node | null | undefined
): boolean {
  try {
    if (!parent || !newNode) return false;

    if (referenceNode && parent.contains(referenceNode)) {
      parent.insertBefore(newNode, referenceNode);
    } else {
      parent.appendChild(newNode);
    }

    return true;
  } catch (error) {
    console.warn('safeInsertBefore error:', error);
    return false;
  }
}

/**
 * 安全地替换子节点
 */
export function safeReplaceChild(
  parent: Node | null,
  newNode: Node | null,
  oldNode: Node | null
): boolean {
  try {
    if (!parent || !newNode || !oldNode) return false;

    if (parent.contains(oldNode)) {
      parent.replaceChild(newNode, oldNode);
      return true;
    }

    return false;
  } catch (error) {
    console.warn('safeReplaceChild error:', error);
    return false;
  }
}

/**
 * 安装全局 DOM 错误处理器
 * 在应用启动时调用
 */
export function installDOMErrorHandler(): void {
  if (typeof window === 'undefined') return;

  // 捕获原生 DOM 操作的错误
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalRemoveChild = Element.prototype.removeChild as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).removeChild = function (child: Node) {
    try {
      return originalRemoveChild.call(this, child);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('is not a child of this node') ||
          error.message.includes('removeChild'))
      ) {
        console.warn(
          '[DOM Error Handler] Caught and suppressed non-critical DOM error:',
          error.message
        );
        // 返回 child 节点，即使操作失败，也不抛出错误
        return child;
      }
      throw error;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalAppendChild = Element.prototype.appendChild as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).appendChild = function (child: Node) {
    try {
      return originalAppendChild.call(this, child);
    } catch (error) {
      console.warn('[DOM Error Handler] Caught appendChild error:', error);
      return child;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalInsertBefore = Element.prototype.insertBefore as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).insertBefore = function (newNode: Node, referenceNode: Node | null) {
    try {
      return originalInsertBefore.call(this, newNode, referenceNode);
    } catch (error) {
      if (error instanceof Error && error.message.includes('insertBefore')) {
        console.warn('[DOM Error Handler] Caught insertBefore error:', error.message);
        return newNode;
      }
      throw error;
    }
  };

  console.log('[DOM Error Handler] Installed successfully');
}

/**
 * 修复异步 React 渲染导致的 DOM 状态不一致
 * 在组件卸载或清理时使用
 */
export function cleanupDOMRecovery(element: Element | null): void {
  if (!element) return;

  try {
    // 确保所有子节点被正确移除
    const children = Array.from(element.childNodes);
    children.forEach(child => {
      try {
        element.removeChild(child);
      } catch (err) {
        console.warn('Error removing child during cleanup:', err);
      }
    });
  } catch (error) {
    console.warn('DOM recovery error:', error);
    // 降级方案
    try {
      element.innerHTML = '';
    } catch (innerErr) {
      console.warn('HTML reset also failed:', innerErr);
    }
  }
}
