<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import hljs from 'highlight.js/lib/core'
import 'highlight.js/styles/atom-one-dark.css'

// 导入常用语言（按使用频率排序）
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import css from 'highlight.js/lib/languages/css'
import scss from 'highlight.js/lib/languages/scss'
import html from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import json from 'highlight.js/lib/languages/json'
import erlang from 'highlight.js/lib/languages/erlang'
import yaml from 'highlight.js/lib/languages/yaml'
import sql from 'highlight.js/lib/languages/sql'
import pgsql from 'highlight.js/lib/languages/pgsql'
import bash from 'highlight.js/lib/languages/bash'
import shell from 'highlight.js/lib/languages/shell'
import perl from 'highlight.js/lib/languages/perl'
import verilog from 'highlight.js/lib/languages/verilog'
import lua from 'highlight.js/lib/languages/lua'
import powershell from 'highlight.js/lib/languages/powershell'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import nginx from 'highlight.js/lib/languages/nginx'
import plaintext from 'highlight.js/lib/languages/plaintext'

// 注册常用语言
const languages = {
  javascript,
  typescript,
  python,
  java,
  cpp,
  c: cpp, // C 使用 cpp 高亮
  csharp,
  'c#': csharp,
  go,
  rust,
  php,
  ruby,
  swift,
  kotlin,
  css,
  scss,
  sass: scss,
  html,
  xml: html,
  markdown,
  md: markdown,
  json,
  yaml,
  yml: yaml,
  sql,
  pgsql,
  verilog,
  erlang,
  perl,
  pl: perl,
  lua,
  bash,
  sh: bash,
  shell,
  zsh: shell,
  powershell,
  ps1: powershell,
  dockerfile,
  docker: dockerfile,
  nginx,
  plaintext,
  text: plaintext,
}

// 批量注册语言
Object.entries(languages).forEach(([name, lang]) => {
  hljs.registerLanguage(name, lang)
})

// Mermaid 动态导入（延迟加载）
let mermaid = null
const loadMermaid = async () => {
  if (!mermaid) {
    const mermaidModule = await import('mermaid')
    mermaid = mermaidModule.default
    mermaid.initialize({
      startOnLoad: false,
      // Mermaid 内置主题：
      // 'default' - 默认主题，蓝色系，清晰易读
      // 'forest' - 森林主题，绿色系
      // 'dark' - 深色主题
      // 'neutral' - 中性主题，灰色系
      // 'base' - 基础主题，可自定义
      theme: 'default',
      // 可选：微调字体大小
      themeVariables: {
        fontSize: '16px',
      },
    })
  }
  return mermaid
}

// KaTeX 配置
const katexOptions = {
  displayMode: true,
  throwOnError: false,
  strict: false,
  // trust: true is a security risk. Only enable it if you trust the input.
  // Since the input is from the user's own notes, the risk is low, but it's better to be safe.
  trust: false,
  macros: {
    "\\sgn": "\\operatorname{sgn}",
    "\\vec": "\\overrightarrow{#1}",
    "\\lcm": "\\operatorname{lcm}",
    "\\rank": "\\operatorname{rank}",
    "\\trace": "\\operatorname{trace}",
    "\\span": "\\operatorname{span}",
    "\\nullspace": "\\operatorname{null}",
    "\\im": "\\operatorname{im}",
    "\\Re": "\\operatorname{Re}",
    "\\Im": "\\operatorname{Im}",
    "\\norm": "\\left\\|#1\\right\\|",
    "\\abs": "\\left|#1\\right|",
    "\\floor": "\\left\\lfloor#1\\right\\rfloor",
    "\\ceil": "\\left\\lceil#1\\right\\rceil",
    "\\argmax": "\\operatorname{argmax}",
    "\\argmin": "\\operatorname{argmin}",
    "\\supp": "\\operatorname{supp}",
    "\\diag": "\\operatorname{diag}",
  },
}

// Marked 自定义扩展
const markedExtensions = {
  extensions: [
    {
      name: 'mermaid',
      level: 'block',
      start(src) {
        return src.indexOf('```mermaid');
      },
      tokenizer(src) {
        const match = src.match(/^```mermaid\n([\s\S]+?)\n```/);
        if (match) {
          return {
            type: 'mermaid',
            raw: match[0],
            text: match[1].trim(),
          };
        }
      },
      renderer(token) {
        // The renderer just creates the container; the actual rendering happens in the lifecycle hook
        return `<div class="mermaid">${token.text}</div>`;
      }
    },
    {
      name: 'blockMath',
      level: 'block',
      start(src) { 
        const markers = ['$$', '\\['];
        const indices = markers
          .map(marker => src.indexOf(marker))
          .filter(index => index !== -1);

        if (indices.length === 0) {
          return;
        }

        return Math.min(...indices);
      },
      tokenizer(src) {
        const matches = [
          /^\$\$([^$]+?)\$\$/,
          /^\\\[([^$]+?)\\\]/
        ];

        for (let i = 0; i < matches.length; i++) {
          const match = src.match(matches[i]);
          if (match) {
            return {
              type: 'blockMath',
              raw: match[0],
              text: match[1].trim(),
            };
          }
        }
      },
      renderer(token) {
        return `<p>${katex.renderToString(token.text, { ...katexOptions, displayMode: true })}</p>`;
      },
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start(src) {
        const markers = ['$', '\\('];
        const indices = markers
          .map(marker => src.indexOf(marker))
          .filter(index => index !== -1);

        if (indices.length === 0) {
          return;
        }

        return Math.min(...indices);
      },
      tokenizer(src) {
        const matches = [
          /^\$([^$]+?)\$/,
          /^\\\((.+?)\\\)/
        ];

        for (let i = 0; i < matches.length; i++) {
          const match = src.match(matches[i]);
          if (match) {
            return {
              type: 'inlineMath',
              raw: match[0],
              text: match[1].trim(),
            };
          }
        }
      },
      renderer(token) {
        return katex.renderToString(token.text, { ...katexOptions, displayMode: false });
      },
    },
  ],
}

// 配置 Marked
marked.use({ gfm: true }, markedExtensions)

marked.use(
  markedHighlight({
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

marked.setOptions({
  breaks: true,
  langPrefix: 'hljs language-',
})

// 组件 Props
const props = defineProps({
  selectedNote: Object,
})

const previewRef = ref(null)

defineExpose({
  previewRef,
})

// 编译 Markdown
const compiledMarkdown = computed(() => {
  return marked(props.selectedNote.content || '')
})

// 监听内容变化并处理渲染
watch(
  compiledMarkdown,
  async () => {
    await nextTick()
    nextTick(processRenderedContent)
  },
  { immediate: true }
)

// 处理渲染后的内容（添加复制按钮、渲染 Mermaid 图表）
const processRenderedContent = async () => {
  if (!previewRef.value) return

  // 为代码块添加复制按钮
  const pres = previewRef.value.querySelectorAll('pre')
  pres.forEach((pre) => {
    const code = pre.querySelector('code')
    if (code && !pre.querySelector('.copy-button')) {
      const button = document.createElement('button')
      button.innerText = 'Copy'
      button.className = 'copy-button'
      button.addEventListener('click', () => {
        navigator.clipboard.writeText(code.innerText).then(() => {
          button.innerText = 'Copied!'
          setTimeout(() => {
            button.innerText = 'Copy'
          }, 2000)
        })
      })
      pre.style.position = 'relative'
      pre.appendChild(button)
    }
  })

  // 渲染 Mermaid 图表（按需加载）
  const mermaidDivs = previewRef.value.querySelectorAll('.mermaid')
  if (mermaidDivs.length > 0) {
    // 只有当页面中有 mermaid 图表时才加载 mermaid 库
    const mermaidInstance = await loadMermaid()
    
    mermaidDivs.forEach(async (div, i) => {
      if (div.hasAttribute('data-mermaid-processed')) return

      const id = `mermaid-svg-${Date.now()}-${i}`
      const graphDefinition = div.textContent || ''
      div.textContent = '' // 清空内容以防止未渲染代码闪烁
      div.setAttribute('data-mermaid-processed', 'true')

      try {
        const { svg } = await mermaidInstance.render(id, graphDefinition)
        div.innerHTML = svg
      } catch (e) {
        console.error('Mermaid 渲染错误:', e)
        div.textContent = ''
      }
    })
  }
}
</script>

<template>
  <div class="preview" v-html="compiledMarkdown" ref="previewRef"></div>
</template>

<style scoped>
.preview {
  width: 100%;
  padding: 1em;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  box-sizing: border-box;
  line-height: 1.6;
  font-size: 1rem;
  word-wrap: break-word;
  word-break: break-word;
}

:deep(h1),
:deep(h2),
:deep(h3),
:deep(h4),
:deep(h5),
:deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.3;
  font-weight: 600;
}

:deep(h1) {
  font-size: 1.8em;
  border-bottom: 2px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

:deep(h3) {
  font-size: 1.3em;
}

:deep(h4) {
  font-size: 1.1em;
}

:deep(p) {
  margin-bottom: 1em;
  line-height: 1.7;
}

:deep(ul),
:deep(ol) {
  margin-bottom: 1em;
  padding-left: 2em;
}

:deep(li) {
  margin-bottom: 0.5em;
  line-height: 1.6;
}

:deep(blockquote) {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid #dfe2e5;
  background-color: #f6f8fa;
  color: #6a737d;
}

:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  overflow-x: auto;
  display: block;
  white-space: nowrap;
  max-width: 100%;
}

:deep(th),
:deep(td) {
  border: 1px solid #dfe2e5;
  padding: 0.6em 1em;
  text-align: left;
}

:deep(th) {
  background-color: #f6f8fa;
  font-weight: 600;
}

:deep(pre) {
  background-color: #282c34;
  color: #abb2bf;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1em 0;
  position: relative;
  font-size: 0.9em;
  line-height: 1.4;
  max-width: 100%;
  box-sizing: border-box;
}

:deep(code) {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
  background-color: #f6f8fa;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  word-wrap: break-word;
  word-break: break-all;
  max-width: 100%;
  box-sizing: border-box;
}

:deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

:deep(.copy-button) {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  background: #444;
  color: white;
  border: none;
  padding: 0.4em 0.8em;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8em;
  opacity: 0;
  transition: all 0.3s;
  font-family: inherit;
}

:deep(pre:hover .copy-button) {
  opacity: 1;
}

:deep(.copy-button:hover) {
  background: #555;
  transform: scale(1.05);
}

:deep(img) {
  max-width: 100%;
  width: 100%;
  height: auto;
  max-height: 70vh;
  border-radius: 6px;
  margin: 1em 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  object-fit: contain;
  box-sizing: border-box;
}

:deep(hr) {
  border: none;
  border-top: 2px solid #eaecef;
  margin: 2em 0;
}

:deep(a) {
  color: #0366d6;
  text-decoration: none;
}

:deep(a:hover) {
  text-decoration: underline;
}

/* 移动端适配 */
@media (max-width: var(--mobile-breakpoint)) {
  .preview {
    padding: var(--spacing-lg);
    font-size: 1.1rem;
    line-height: 1.7;
    overflow-x: hidden;
    word-wrap: break-word;
    word-break: break-word;
    max-width: 100vw;
  }
  
  :deep(h1) {
    font-size: 1.6em;
    margin-top: 1em;
  }
  
  :deep(h2) {
    font-size: 1.4em;
    margin-top: 1em;
  }
  
  :deep(h3) {
    font-size: 1.2em;
    margin-top: 1em;
  }
  
  :deep(h4) {
    font-size: 1.1em;
    margin-top: 1em;
  }
  
  :deep(p) {
    margin-bottom: 1.2em;
    line-height: 1.8;
  }
  
  :deep(ul),
  :deep(ol) {
    padding-left: 1.5em;
  }
  
  :deep(li) {
    margin-bottom: 0.7em;
    line-height: 1.7;
  }
  
  :deep(blockquote) {
    margin: 1.5em 0;
    padding: 1em 1.2em;
    font-size: 1rem;
  }
  
  :deep(table) {
    font-size: 0.9rem;
    margin: 1.5em 0;
    width: 100%;
    max-width: 100%;
    table-layout: fixed;
  }
  
  :deep(th),
  :deep(td) {
    padding: 0.8em 0.6em;
    min-width: 80px;
    max-width: 120px;
    word-wrap: break-word;
    word-break: break-word;
    overflow: hidden;
  }
  
  :deep(pre) {
    padding: 1.2em;
    font-size: 0.85rem;
    border-radius: 10px;
    margin: 1.5em 0;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    max-width: calc(100vw - 3em);
    box-sizing: border-box;
  }
  
  :deep(code) {
    font-size: 0.85rem;
    padding: 0.3em 0.5em;
    border-radius: 4px;
    word-wrap: break-word;
    word-break: break-all;
    max-width: 100%;
  }
  
  :deep(pre code) {
    word-wrap: normal;
    word-break: normal;
    white-space: pre;
  }
  
  :deep(.copy-button) {
    padding: 0.6em 1em;
    font-size: 0.9rem;
    top: 0.8em;
    right: 0.8em;
    opacity: 0.8; /* 移动端始终显示 */
    min-height: var(--touch-target-size);
    min-width: 60px;
  }
  
  :deep(img) {
    max-height: 50vh;
    border-radius: 8px;
    margin: 1.5em 0;
    width: 100%;
    max-width: 100%;
    object-fit: contain;
  }
  
  :deep(hr) {
    margin: 2.5em 0;
  }
}

/* 平板端适配 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  .preview {
    padding: 1.3em;
    font-size: 1.05rem;
  }
  
  :deep(h1) {
    font-size: 1.7em;
  }
  
  :deep(h2) {
    font-size: 1.45em;
  }
  
  :deep(pre) {
    font-size: 0.88rem;
    padding: 1.1em;
  }
  
  :deep(code) {
    font-size: 0.88rem;
  }
}

/* 横屏模式优化 */
@media (max-width: var(--mobile-breakpoint)) and (orientation: landscape) {
  .preview {
    padding: 1em 1.5em;
    font-size: 1rem;
  }
  
  :deep(h1) {
    font-size: 1.4em;
    margin-top: 0.8em;
  }
  
  :deep(h2) {
    font-size: 1.3em;
    margin-top: 0.8em;
  }
  
  :deep(p) {
    margin-bottom: 1em;
    line-height: 1.6;
  }
  
  :deep(img) {
    max-height: 40vh;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  :deep(.copy-button) {
    opacity: 0.8 !important;
  }
  
  :deep(.copy-button:hover) {
    background: #444;
    transform: none;
  }
  
  :deep(.copy-button:active) {
    background: #555;
    transform: scale(0.95);
  }
  
  /* 优化触摸滚动 */
  .preview {
    -webkit-overflow-scrolling: touch;
  }
  
  :deep(pre) {
    -webkit-overflow-scrolling: touch;
  }
  
  :deep(table) {
    -webkit-overflow-scrolling: touch;
  }
}

/* Mermaid 图表样式优化 */
:deep(.mermaid) {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 2em 0;
  padding: 1.5em;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 100px;
  background: transparent; /* 让 Mermaid 自己控制背景 */
}

:deep(.mermaid svg) {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

/* 优化 Mermaid 图表中的文字 */
:deep(.mermaid .nodeLabel),
:deep(.mermaid .edgeLabel),
:deep(.mermaid .labelText),
:deep(.mermaid text) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif !important;
}

/* 移动端 Mermaid 优化 */
@media (max-width: var(--mobile-breakpoint)) {
  :deep(.mermaid) {
    padding: 1em;
    margin: 1.5em 0;
    border-radius: 10px;
    -webkit-overflow-scrolling: touch;
  }
  
  :deep(.mermaid svg) {
    max-width: 100%;
    height: auto;
  }
}

/* 平板端 Mermaid 优化 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  :deep(.mermaid) {
    padding: 1.3em;
  }
}
</style>
