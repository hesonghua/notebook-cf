<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { marked } from 'marked'
import { markedHighlight } from "marked-highlight";
import mermaid from 'mermaid'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import plaintext from 'highlight.js/lib/languages/plaintext'
import 'highlight.js/styles/atom-one-dark.css'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
});


// 注册常用语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('plaintext', plaintext)

const props = defineProps({
  selectedNote: Object,
})

const previewRef = ref(null)

defineExpose({
  previewRef,
})

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
};

const extension = {
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
};

marked.use({ gfm: true }, extension);

marked.use(markedHighlight({
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

marked.setOptions({
  breaks: true,
  langPrefix: 'hljs language-',
});

const compiledMarkdown = computed(() => {
  return marked(props.selectedNote.content || '');
})

watch(compiledMarkdown, async () => {
  await nextTick();
  // The 'post' flush option ensures this callback runs after the DOM has been updated,
  nextTick(processRenderedContent);
}, { immediate: true });

const processRenderedContent = () => {
  if (!previewRef.value) return;

  // Add copy buttons to pre blocks
  const pres = previewRef.value.querySelectorAll('pre');
  pres.forEach(pre => {
    const code = pre.querySelector('code');
    if (code && !pre.querySelector('.copy-button')) {
      const button = document.createElement('button');
      button.innerText = 'Copy';
      button.className = 'copy-button';
      button.addEventListener('click', () => {
        navigator.clipboard.writeText(code.innerText).then(() => {
          button.innerText = 'Copied!';
          setTimeout(() => {
            button.innerText = 'Copy';
          }, 2000);
        });
      });
      pre.style.position = 'relative';
      pre.appendChild(button);
    }
  });

  // Render Mermaid diagrams using the modern async API
  const mermaidDivs = previewRef.value.querySelectorAll('.mermaid');
  mermaidDivs.forEach(async (div, i) => {
    if (div.hasAttribute('data-mermaid-processed')) return;

    const id = `mermaid-svg-${Date.now()}-${i}`;
    const graphDefinition = div.textContent || '';
    div.textContent = ''; // Clear content to prevent flash of unrendered code
    div.setAttribute('data-mermaid-processed', 'true');

    try {
      const { svg } = await mermaid.render(id, graphDefinition);
      div.innerHTML = svg;
    } catch (e) {
      console.error('Mermaid rendering error:', e);
      div.textContent = '';
    }
  });
};
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
</style>
