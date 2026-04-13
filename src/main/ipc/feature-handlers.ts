import { ipcMain } from 'electron'
import { AppConfig } from '../store/app-config'
import { DEFAULT_FEATURES, type FeatureFlags } from '../../shared/feature-types'

export function registerFeatureHandlers(): void {
  ipcMain.handle('features:get', () => AppConfig.getInstance().getFeatures())

  ipcMain.handle('features:set', (_, key: string, enabled: boolean) => {
    if (!(key in DEFAULT_FEATURES)) {
      console.warn(`[features:set] unknown key rejected: "${key}"`)
      return
    }
    AppConfig.getInstance().setFeature(key as keyof FeatureFlags, enabled)
  })
}
