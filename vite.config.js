import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare()
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	build: {
		chunkSizeWarningLimit: 2500, // 提高警告阈值（mermaid 本身就很大，但已按需加载）
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('node_modules')) {
						if (id.includes('codemirror')) {
							return 'codemirror';
						} else if (id.includes('markdown-it')) {
							return 'markdown-it';
						} else if (id.includes('katex')) {
							return 'katex';
						} else if (id.includes('highlight.js')) {
							return 'highlight';
						} else if (id.includes('mermaid')) {
							return 'mermaid';
						}
					}
				}
			}
		}
	}
})
