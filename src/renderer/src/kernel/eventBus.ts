/**
 * EventBus — 타입 안전 이벤트 에미터
 * AppEvents 기반 on/emit/off
 */
import type { AppEvent, AppEventType, EventPayload } from './types'

type Handler<T extends AppEventType> = (payload: EventPayload<T>) => void

class EventBusImpl {
  private readonly listeners = new Map<string, Set<Handler<AppEventType>>>()

  on<T extends AppEventType>(type: T, handler: Handler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler as Handler<AppEventType>)
    return () => this.off(type, handler)
  }

  off<T extends AppEventType>(type: T, handler: Handler<T>): void {
    this.listeners.get(type)?.delete(handler as Handler<AppEventType>)
  }

  emit<T extends AppEventType>(event: Extract<AppEvent, { type: T }>): void {
    this.listeners.get(event.type)?.forEach(h => h(event.payload as EventPayload<AppEventType>))
  }

  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBusImpl()
