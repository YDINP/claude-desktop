import './styles/global.css'
import 'katex/dist/katex.min.css'
import { createRoot } from 'react-dom/client'
import App from './App'
import { runStorageMigration } from './utils/storage-migrate'

// localStorage 키 마이그레이션 (구 키 → 신 키 1회 자동 이전)
runStorageMigration()

// Apply saved theme before first render to prevent flash
const savedTheme = localStorage.getItem('theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')!).render(
  <App />
)
