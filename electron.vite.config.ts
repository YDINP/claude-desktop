import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-syntax': ['react-syntax-highlighter'],
            'vendor-markdown': ['react-markdown', 'remark-gfm'],
            'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
            'vendor-mermaid': ['mermaid'],
            'vendor-monaco': ['monaco-editor', '@monaco-editor/react'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
