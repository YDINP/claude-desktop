/**
 * Trigger a browser file download from in-memory content.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/markdown',
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
