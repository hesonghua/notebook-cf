<script setup>
import { computed, ref, watch, nextTick, inject } from 'vue'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/atom-one-dark.css'

const marked = inject('marked');
const loadMermaid = inject('loadMermaid');


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
    debugger;
  const source = props.selectedNote.content || '';

  const result = marked(source);

  return result;
})

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
