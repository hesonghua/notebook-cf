import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useConfigStore } from './stores/configStore'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import katex from 'katex'
import hljs from 'highlight.js'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import mitt from 'mitt';


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
          /^\s*\$\$([^$]+?)\$\$/,
          /^\s*\\\[([^$]+?)\\\]/
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

// Mermaid 动态导入（延迟加载）
let __mermaid = null
const loadMermaid = async () => {
  if (!__mermaid) {
    const mermaidModule = await import('mermaid')
    __mermaid = mermaidModule.default
    __mermaid.initialize({
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
  return __mermaid
}

const app = createApp(App)
const emitter = mitt();

app.provide('emitter', emitter);
app.provide('marked', marked);
app.provide('loadMermaid', loadMermaid);
app.directive('focus', {
  mounted(el) {
    el.focus()
  }
})

app.use(createPinia())
app.use(router)

const configStore = useConfigStore()
configStore.fetchConfig().then(() => {
  app.mount('body')
})
