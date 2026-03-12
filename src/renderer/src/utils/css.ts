export function applyCustomCSS(css: string): void {
  let styleEl = document.getElementById('custom-css') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'custom-css'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css
}
