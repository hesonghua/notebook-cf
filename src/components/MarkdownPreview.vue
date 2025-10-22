<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'


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
      name: 'pageBreak',
      level: 'block',
      start(src) {
        const markers = ['---PAGEBREAK---', '<!-- PAGEBREAK -->'];
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
          /^---PAGEBREAK---\s*/,
          /^<!-- PAGEBREAK -->\s*/
        ];
        
        for (let i = 0; i < matches.length; i++) {
          const match = src.match(matches[i]);
          if (match) {
            return {
              type: 'pageBreak',
              raw: match[0],
            };
          }
        }
      },
      renderer(token) {
        return '<div class="page-break"></div>';
      }
    },
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
  sanitize: false,
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
