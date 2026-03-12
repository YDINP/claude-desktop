import WebSocket from 'ws'
import type { CCEvent } from '../../shared/ipc-schema'

interface CCBridgeOptions {
  onEvent?: (event: CCEvent) => void
  onStatusChange?: (connected: boolean) => void
}

class CCBridge {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _port = 9090
  private _version = '2x'
  private _connected = false
  private _intentionalDisconnect = false
  private options: CCBridgeOptions = {}

  get connected() { return this._connected }
  get port() { return this._port }
  get version() { return this._version }

  setOptions(opts: CCBridgeOptions) { this.options = opts }

  async connect(port = 9090): Promise<boolean> {
    this._intentionalDisconnect = false
    this._port = port
    this._version = port === 9091 ? '3x' : '2x'
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws?.readyState === WebSocket.OPEN) return true

    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`)
      const timeout = setTimeout(() => { ws.terminate(); resolve(false) }, 3000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.ws = ws
        this._connected = true
        this.options.onStatusChange?.(true)
        resolve(true)
      })

      ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString())
          this.options.onEvent?.(event)
        } catch {}
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        this._connected = false
        this.options.onStatusChange?.(false)
        this.scheduleReconnect()
        resolve(false)
      })

      ws.on('error', (err) => {
        clearTimeout(timeout)
        console.error('[cc-bridge] error:', err.message)
        this._connected = false
        this.scheduleReconnect()
        resolve(false)
      })
    })
  }

  disconnect() {
    this._intentionalDisconnect = true
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this.ws?.close()
    this.ws = null
    this._connected = false
  }

  async getTree() {
    const resp = await fetch(`http://127.0.0.1:${this._port}/scene/tree`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async getNode(uuid: string) {
    const resp = await fetch(`http://127.0.0.1:${this._port}/node/${uuid}`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async setProperty(uuid: string, key: string, value: unknown) {
    const resp = await fetch(`http://127.0.0.1:${this._port}/node/${uuid}/property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async moveNode(uuid: string, x: number, y: number) {
    const resp = await fetch(`http://127.0.0.1:${this._port}/node/${uuid}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return resp.json()
  }

  async checkStatus() {
    try {
      const resp = await fetch(`http://127.0.0.1:${this._port}/status`, { signal: AbortSignal.timeout(2000) })
      if (!resp.ok) return null
      return resp.json()
    } catch { return null }
  }

  private scheduleReconnect() {
    if (this._intentionalDisconnect) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(this._port)
    }, 3000)
  }
}

export const ccBridge = new CCBridge()
