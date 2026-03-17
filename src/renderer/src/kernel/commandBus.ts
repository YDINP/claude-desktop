/**
 * CommandBus — Command 라우터
 * register(type, handler) / dispatch(command)
 * async 핸들러 지원
 */
import type { AppCommand, AppCommandType, CommandPayload } from './types'

type CommandHandler<T extends AppCommandType> = (
  payload: CommandPayload<T>
) => Promise<unknown> | unknown

class CommandBusImpl {
  private readonly handlers = new Map<string, CommandHandler<AppCommandType>>()

  register<T extends AppCommandType>(type: T, handler: CommandHandler<T>): void {
    if (this.handlers.has(type)) {
      console.warn(`[CommandBus] handler already registered for "${type}" — overwriting`)
    }
    this.handlers.set(type, handler as CommandHandler<AppCommandType>)
  }

  async dispatch<T extends AppCommandType>(
    command: Extract<AppCommand, { type: T }>
  ): Promise<unknown> {
    const handler = this.handlers.get(command.type)
    if (!handler) {
      console.warn(`[CommandBus] no handler for "${command.type}"`)
      return undefined
    }
    return handler(command.payload as CommandPayload<AppCommandType>)
  }

  hasHandler(type: AppCommandType): boolean {
    return this.handlers.has(type)
  }
}

export const commandBus = new CommandBusImpl()
