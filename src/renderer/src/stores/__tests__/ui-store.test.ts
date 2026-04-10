import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../ui-store'

// Reset store between tests
beforeEach(() => {
  useUIStore.setState({
    paletteOpen: false,
    shortcutsOpen: false,
    settingsOpen: false,
    lightbox: null,
    pendingInsert: undefined,
    ccTab: 'claude',
    ccSplitRatio: 0.5,
    mainPanelTab: null,
    activeSidebarIconTab: null,
    chatFocusTrigger: 0,
    chatSearchTrigger: 0,
    scrollToMessageId: null,
  })
})

describe('useUIStore', () => {
  describe('togglePalette', () => {
    it('setPaletteOpen(true) opens palette', () => {
      useUIStore.getState().setPaletteOpen(true)
      expect(useUIStore.getState().paletteOpen).toBe(true)
    })

    it('setPaletteOpen(false) closes palette', () => {
      useUIStore.setState({ paletteOpen: true })
      useUIStore.getState().setPaletteOpen(false)
      expect(useUIStore.getState().paletteOpen).toBe(false)
    })

    it('setPaletteOpen with updater function toggles', () => {
      useUIStore.getState().setPaletteOpen(prev => !prev)
      expect(useUIStore.getState().paletteOpen).toBe(true)
      useUIStore.getState().setPaletteOpen(prev => !prev)
      expect(useUIStore.getState().paletteOpen).toBe(false)
    })
  })

  describe('toggleShortcuts', () => {
    it('setShortcutsOpen(true) opens shortcuts overlay', () => {
      useUIStore.getState().setShortcutsOpen(true)
      expect(useUIStore.getState().shortcutsOpen).toBe(true)
    })

    it('setShortcutsOpen(false) closes shortcuts overlay', () => {
      useUIStore.setState({ shortcutsOpen: true })
      useUIStore.getState().setShortcutsOpen(false)
      expect(useUIStore.getState().shortcutsOpen).toBe(false)
    })

    it('setShortcutsOpen with updater function toggles', () => {
      useUIStore.getState().setShortcutsOpen(prev => !prev)
      expect(useUIStore.getState().shortcutsOpen).toBe(true)
    })
  })

  describe('toggleSettings', () => {
    it('setSettingsOpen(true) opens settings panel', () => {
      useUIStore.getState().setSettingsOpen(true)
      expect(useUIStore.getState().settingsOpen).toBe(true)
    })

    it('setSettingsOpen(false) closes settings panel', () => {
      useUIStore.setState({ settingsOpen: true })
      useUIStore.getState().setSettingsOpen(false)
      expect(useUIStore.getState().settingsOpen).toBe(false)
    })

    it('setSettingsOpen with updater function toggles', () => {
      useUIStore.getState().setSettingsOpen(prev => !prev)
      expect(useUIStore.getState().settingsOpen).toBe(true)
    })
  })

  describe('setLightbox', () => {
    it('sets lightbox with src and alt', () => {
      useUIStore.getState().setLightbox({ src: 'image.png', alt: 'test image' })
      expect(useUIStore.getState().lightbox).toEqual({ src: 'image.png', alt: 'test image' })
    })

    it('sets lightbox with src only', () => {
      useUIStore.getState().setLightbox({ src: 'photo.jpg' })
      expect(useUIStore.getState().lightbox).toEqual({ src: 'photo.jpg' })
    })

    it('clears lightbox with null', () => {
      useUIStore.setState({ lightbox: { src: 'image.png' } })
      useUIStore.getState().setLightbox(null)
      expect(useUIStore.getState().lightbox).toBeNull()
    })
  })

  describe('setCcTab', () => {
    it('starts with claude tab', () => {
      expect(useUIStore.getState().ccTab).toBe('claude')
    })

    it('setCCTab switches to editor', () => {
      useUIStore.getState().setCCTab('editor')
      expect(useUIStore.getState().ccTab).toBe('editor')
    })

    it('setCCTab switches back to claude', () => {
      useUIStore.setState({ ccTab: 'editor' })
      useUIStore.getState().setCCTab('claude')
      expect(useUIStore.getState().ccTab).toBe('claude')
    })

    it('setCCTab with updater function toggles', () => {
      useUIStore.getState().setCCTab(prev => (prev === 'claude' ? 'editor' : 'claude'))
      expect(useUIStore.getState().ccTab).toBe('editor')
      useUIStore.getState().setCCTab(prev => (prev === 'claude' ? 'editor' : 'claude'))
      expect(useUIStore.getState().ccTab).toBe('claude')
    })
  })

  describe('bumpChatFocusTrigger', () => {
    it('starts at 0', () => {
      expect(useUIStore.getState().chatFocusTrigger).toBe(0)
    })

    it('increments by 1 on each call', () => {
      useUIStore.getState().bumpChatFocusTrigger()
      expect(useUIStore.getState().chatFocusTrigger).toBe(1)
      useUIStore.getState().bumpChatFocusTrigger()
      expect(useUIStore.getState().chatFocusTrigger).toBe(2)
    })

    it('multiple bumps accumulate', () => {
      for (let i = 0; i < 5; i++) useUIStore.getState().bumpChatFocusTrigger()
      expect(useUIStore.getState().chatFocusTrigger).toBe(5)
    })
  })

  describe('independent state isolation', () => {
    it('toggling palette does not affect shortcuts or settings', () => {
      useUIStore.getState().setPaletteOpen(true)
      expect(useUIStore.getState().shortcutsOpen).toBe(false)
      expect(useUIStore.getState().settingsOpen).toBe(false)
    })

    it('setting lightbox does not affect chatFocusTrigger', () => {
      useUIStore.getState().setLightbox({ src: 'img.png' })
      expect(useUIStore.getState().chatFocusTrigger).toBe(0)
    })
  })
})
