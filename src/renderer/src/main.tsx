import './styles/global.css'
import 'katex/dist/katex.min.css'
import { createRoot } from 'react-dom/client'
import App from './App'

// Apply saved theme before first render to prevent flash
const savedTheme = localStorage.getItem('theme') ?? 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

createRoot(document.getElementById('root')!).render(
  <App />
)
