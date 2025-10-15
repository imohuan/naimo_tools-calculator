/// <reference path="../typings/naimo.d.ts" />

import './style.css';

// ==================== 类型定义 ====================

interface CalculationResult {
  success: boolean;
  result?: number;
  error?: string;
}

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: number;
}

// ==================== 热重载 ====================
if (import.meta.hot) {
  // 监听 preload 文件变化事件
  import.meta.hot.on('preload-changed', async (data) => {
    console.log('📝 检测到 preload 变化:', data);
    // 触发 preload 构建
    console.log('🔨 正在触发 preload 构建...');
    try {
      const response = await fetch('/__preload_build');
      const result = await response.json();
      if (result.success) {
        console.log('✅ Preload 构建完成');
        // 构建成功后，触发热重载
        await window.naimo.hot()
        console.log('🔄 Preload 热重载完成');
        location.reload()
      } else {
        console.error('❌ Preload 构建失败');
      }
    } catch (error) {
      console.error('❌ 触发 preload 构建失败:', error);
    }
  })
}

// =======================================================

// DOM 元素
let inputElement: HTMLInputElement | null = null;
let resultElement: HTMLElement | null = null;
let historyElement: HTMLElement | null = null;
let emptyStateElement: HTMLElement | null = null;
let clearAllButton: HTMLButtonElement | null = null;

// 历史记录
let history: HistoryItem[] = [];

/**
 * 安全的数学表达式计算
 * 使用 Function 构造器在受限环境中执行
 */
function calculateExpression(expression: string): CalculationResult {
  try {
    // 清理表达式
    let cleanExpr = expression.trim();

    if (!cleanExpr) {
      return { success: true, result: 0 };
    }

    // 替换常见的数学符号
    cleanExpr = cleanExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/\s+/g, ''); // 移除空格

    // 安全性检查：只允许数字、运算符和括号
    const safePattern = /^[0-9+\-*/.()%\s]+$/;
    if (!safePattern.test(cleanExpr)) {
      return { success: false, error: '包含非法字符' };
    }

    // 处理百分比
    cleanExpr = cleanExpr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // 使用 Function 计算
    const result = Function(`"use strict"; return (${cleanExpr})`)();

    // 检查结果是否有效
    if (typeof result !== 'number' || !isFinite(result)) {
      return { success: false, error: '计算结果无效' };
    }

    // 处理精度
    const rounded = Math.round(result * 1e10) / 1e10;

    return { success: true, result: rounded };
  } catch (error) {
    return { success: false, error: '表达式错误' };
  }
}

/**
 * 更新结果显示
 */
function updateResult(expression: string): void {
  if (!resultElement) return;

  if (!expression.trim()) {
    resultElement.textContent = '';
    resultElement.className = 'w-full text-right text-xl text-gray-500 min-h-[1.5rem]';
    return;
  }

  const calculation = calculateExpression(expression);

  if (calculation.success && calculation.result !== undefined) {
    // 格式化结果
    let displayResult = String(calculation.result);

    // 如果结果太长，使用科学记数法
    if (displayResult.length > 15) {
      displayResult = calculation.result.toExponential(8);
    }

    resultElement.textContent = `= ${displayResult}`;
    resultElement.className = 'w-full text-right text-xl text-gray-500 min-h-[1.5rem] success';
  } else {
    resultElement.textContent = calculation.error || '错误';
    resultElement.className = 'w-full text-right text-xl text-gray-500 min-h-[1.5rem] error';
  }
}

/**
 * 添加历史记录
 */
function addToHistory(expression: string, result: number): void {
  const item: HistoryItem = {
    id: Date.now().toString(),
    expression,
    result,
    timestamp: Date.now()
  };

  history.unshift(item);

  // 限制历史记录数量为100条
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  saveHistory();
  renderHistory();
}

/**
 * 删除历史记录项
 */
function deleteHistoryItem(id: string): void {
  history = history.filter(item => item.id !== id);
  saveHistory();
  renderHistory();
}

/**
 * 清空所有历史记录
 */
function clearAllHistory(): void {
  history = [];
  saveHistory();
  renderHistory();
}

/**
 * 渲染历史记录
 */
function renderHistory(): void {
  if (!historyElement || !emptyStateElement) return;

  if (history.length === 0) {
    historyElement.innerHTML = '';
    emptyStateElement.style.display = 'block';
    return;
  }

  emptyStateElement.style.display = 'none';

  historyElement.innerHTML = history.map(item => `
    <div class="history-item flex items-center justify-between group">
      <div class="flex-1 cursor-pointer overflow-hidden" data-id="${item.id}" data-action="use">
        <div class="history-content">
          <span class="expression">${escapeHtml(item.expression)}</span>
          <span class="result">= ${item.result}</span>
        </div>
      </div>
      <button 
        class="delete-btn ml-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        data-id="${item.id}"
        data-action="delete"
        title="删除"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `).join('');

  // 绑定点击事件
  historyElement.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (e.currentTarget as HTMLElement).dataset.id;
      if (id) deleteHistoryItem(id);
    });
  });

  historyElement.querySelectorAll('[data-action="use"]').forEach(item => {
    item.addEventListener('click', () => {
      const id = (item as HTMLElement).dataset.id;
      const historyItem = history.find(h => h.id === id);
      if (historyItem && inputElement) {
        inputElement.value = historyItem.expression;
        updateResult(historyItem.expression);
        inputElement.focus();
      }
    });
  });
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 保存历史记录到本地存储
 */
function saveHistory(): void {
  try {
    localStorage.setItem('calculator_history', JSON.stringify(history));
  } catch (error) {
    console.error('保存历史记录失败:', error);
  }
}

/**
 * 加载历史记录
 */
function loadHistory(): void {
  try {
    const saved = localStorage.getItem('calculator_history');
    if (saved) {
      history = JSON.parse(saved);
      renderHistory();
    }
  } catch (error) {
    console.error('加载历史记录失败:', error);
    history = [];
  }
}

/**
 * 处理输入事件
 */
function handleInput(): void {
  if (!inputElement) return;
  const expression = inputElement.value;
  updateResult(expression);
}

/**
 * 处理键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  if (!inputElement || !resultElement) return;

  // Enter 键 - 保存到历史记录
  if (event.key === 'Enter') {
    event.preventDefault();
    const expression = inputElement.value.trim();

    if (!expression) return;

    const calculation = calculateExpression(expression);

    if (calculation.success && calculation.result !== undefined) {
      // 添加到历史记录
      addToHistory(expression, calculation.result);

      // 清空输入框
      inputElement.value = '';
      resultElement.textContent = '';
      resultElement.className = 'w-full text-right text-xl text-gray-500 min-h-[1.5rem]';
    }
  }

  // Escape 键 - 清空输入
  else if (event.key === 'Escape') {
    event.preventDefault();
    inputElement.value = '';
    resultElement.textContent = '';
    resultElement.className = 'w-full text-right text-xl text-gray-500 min-h-[1.5rem]';
  }
}

/**
 * 应用初始化
 */
async function initApp(): Promise<void> {
  console.log('计算器初始化...');

  // 获取 DOM 元素
  inputElement = document.getElementById('input') as HTMLInputElement;
  resultElement = document.getElementById('result');
  historyElement = document.getElementById('history');
  emptyStateElement = document.getElementById('emptyState');
  clearAllButton = document.getElementById('clearAll') as HTMLButtonElement;

  if (!inputElement || !resultElement || !historyElement || !emptyStateElement || !clearAllButton) {
    console.error('无法找到必要的 DOM 元素');
    return;
  }

  // 加载历史记录
  loadHistory();

  // 绑定事件
  inputElement.addEventListener('input', handleInput);
  inputElement.addEventListener('keydown', handleKeydown);

  clearAllButton.addEventListener('click', () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      clearAllHistory();
    }
  });

  // 自动聚焦
  inputElement.focus();

  // 记录初始化完成
  naimo.log.info('计算器初始化完成');
}

// ==================== 入口 ====================

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

