import Store from 'electron-store'

interface WorkspaceEntry {
  path: string
  openTabs: string[]
  activeTab: string
}

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
}

export interface Snippet {
  id: string
  name: string
  content: string
  language?: string
  category?: string
  shortcut?: string
  createdAt: number
}

export interface SystemPromptProfile {
  id: string
  name: string
  content: string
}

export interface Task {
  id: string
  text: string
  done: boolean
  createdAt: number
  priority?: 'low' | 'medium' | 'high'
}

export interface NotificationSettings {
  responseComplete: boolean
  backgroundOnly: boolean
  longSession: boolean
  contextWarning: boolean
}

interface ConfigSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number }
  recentProjects: string[]
  currentProject: string | null
  selectedModel: string
  openWorkspaces: WorkspaceEntry[]
  activeWorkspacePath: string | null
  promptTemplates: PromptTemplate[]
  theme: 'dark' | 'light' | 'system'
  fontSize: number
  maxTokensPerRequest: number
  temperature: number
  showTimestamps: boolean
  projectSystemPrompts: Record<string, string>
  recentFiles: string[]
  accentColor: string
  compactMode: boolean
  soundEnabled: boolean
  favoriteFiles: string[]
  customCSS: string
  snippets: Snippet[]
  terminalTheme: string
  systemPromptProfiles: SystemPromptProfile[]
  tasks: Task[]
  notificationSettings: NotificationSettings
}

const defaults: ConfigSchema = {
  windowBounds: { width: 1400, height: 900 },
  recentProjects: [],
  currentProject: null,
  selectedModel: 'claude-opus-4-6',
  openWorkspaces: [],
  activeWorkspacePath: null,
  promptTemplates: [],
  theme: 'dark',
  fontSize: 13,
  maxTokensPerRequest: 0,
  temperature: 1.0,
  showTimestamps: true,
  projectSystemPrompts: {},
  recentFiles: [],
  accentColor: '#4f9cf9',
  compactMode: false,
  soundEnabled: true,
  favoriteFiles: [],
  customCSS: '',
  snippets: [],
  terminalTheme: 'dark',
  systemPromptProfiles: [],
  tasks: [],
  notificationSettings: { responseComplete: true, backgroundOnly: true, longSession: false, contextWarning: true },
}

export class AppConfig {
  private static instance: AppConfig
  private store: Store<ConfigSchema>

  private constructor() {
    this.store = new Store<ConfigSchema>({ defaults })
  }

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig()
    }
    return AppConfig.instance
  }

  getWindowBounds() {
    return this.store.get('windowBounds')
  }

  setWindowBounds(bounds: Partial<ConfigSchema['windowBounds']>) {
    this.store.set('windowBounds', { ...this.getWindowBounds(), ...bounds })
  }

  getRecentProjects(): string[] {
    return this.store.get('recentProjects')
  }

  addRecentProject(path: string) {
    const recent = this.getRecentProjects().filter((p) => p !== path)
    recent.unshift(path)
    this.store.set('recentProjects', recent.slice(0, 20))
  }

  getCurrentProject(): string | null {
    return this.store.get('currentProject')
  }

  setCurrentProject(path: string | null) {
    this.store.set('currentProject', path)
    if (path) this.addRecentProject(path)
  }

  getSelectedModel(): string {
    return this.store.get('selectedModel')
  }

  setSelectedModel(model: string) {
    this.store.set('selectedModel', model)
  }

  getOpenWorkspaces(): { workspaces: WorkspaceEntry[]; activePath: string | null } {
    const ws = (this.store.get('openWorkspaces') as WorkspaceEntry[] | undefined) ?? []
    return {
      workspaces: ws,
      activePath: this.store.get('activeWorkspacePath'),
    }
  }

  setOpenWorkspaces(workspaces: WorkspaceEntry[], activePath: string | null) {
    this.store.set('openWorkspaces', workspaces)
    this.store.set('activeWorkspacePath', activePath)
  }

  getPromptTemplates(): PromptTemplate[] {
    return (this.store.get('promptTemplates') as PromptTemplate[] | undefined) ?? []
  }

  savePromptTemplate(template: PromptTemplate): void {
    const templates = this.getPromptTemplates().filter((t) => t.id !== template.id)
    templates.unshift(template)
    this.store.set('promptTemplates', templates)
  }

  deletePromptTemplate(id: string): void {
    const templates = this.getPromptTemplates().filter((t) => t.id !== id)
    this.store.set('promptTemplates', templates)
  }

  getTheme(): 'dark' | 'light' | 'system' {
    return this.store.get('theme')
  }

  setTheme(theme: 'dark' | 'light' | 'system') {
    this.store.set('theme', theme)
  }

  getFontSize(): number {
    return this.store.get('fontSize')
  }

  setFontSize(size: number) {
    this.store.set('fontSize', Math.max(12, Math.min(18, size)))
  }

  getMaxTokensPerRequest(): number {
    return this.store.get('maxTokensPerRequest')
  }

  setMaxTokensPerRequest(tokens: number) {
    this.store.set('maxTokensPerRequest', Math.max(0, tokens))
  }

  getTemperature(): number {
    return (this.store.get('temperature') as number | undefined) ?? 1.0
  }

  setTemperature(v: number): void {
    this.store.set('temperature', Math.max(0, Math.min(1, v)))
  }

  getShowTimestamps(): boolean {
    return this.store.get('showTimestamps')
  }

  setShowTimestamps(show: boolean) {
    this.store.set('showTimestamps', show)
  }

  getProjectSystemPrompt(projectPath: string): string {
    const prompts = (this.store.get('projectSystemPrompts') as Record<string, string> | undefined) ?? {}
    return prompts[projectPath] ?? ''
  }

  setProjectSystemPrompt(projectPath: string, prompt: string): void {
    const prompts = (this.store.get('projectSystemPrompts') as Record<string, string> | undefined) ?? {}
    if (prompt.trim()) {
      prompts[projectPath] = prompt
    } else {
      delete prompts[projectPath]
    }
    this.store.set('projectSystemPrompts', prompts)
  }

  getRecentFiles(): string[] {
    return (this.store.get('recentFiles') as string[] | undefined) ?? []
  }

  addRecentFile(filePath: string): void {
    const recent = this.getRecentFiles().filter(f => f !== filePath)
    recent.unshift(filePath)
    this.store.set('recentFiles', recent.slice(0, 15))
  }

  clearRecentFiles(): void {
    this.store.set('recentFiles', [])
  }

  getAccentColor(): string {
    return (this.store.get('accentColor') as string | undefined) ?? '#4f9cf9'
  }

  setAccentColor(color: string): void {
    this.store.set('accentColor', color)
  }

  getCompactMode(): boolean {
    return (this.store.get('compactMode') as boolean | undefined) ?? false
  }

  setCompactMode(compact: boolean): void {
    this.store.set('compactMode', compact)
  }

  getSoundEnabled(): boolean {
    return (this.store.get('soundEnabled') as boolean | undefined) ?? true
  }

  setSoundEnabled(v: boolean): void {
    this.store.set('soundEnabled', v)
  }

  getFavoriteFiles(): string[] {
    return (this.store.get('favoriteFiles') as string[] | undefined) ?? []
  }

  addFavoriteFile(path: string): void {
    const favorites = this.getFavoriteFiles()
    if (!favorites.includes(path)) {
      this.store.set('favoriteFiles', [...favorites, path])
    }
  }

  removeFavoriteFile(path: string): void {
    const favorites = this.getFavoriteFiles()
    this.store.set('favoriteFiles', favorites.filter(f => f !== path))
  }

  getCustomCSS(): string {
    return (this.store.get('customCSS') as string | undefined) ?? ''
  }

  setCustomCSS(css: string): void {
    this.store.set('customCSS', css)
  }

  getSnippets(): Snippet[] {
    return (this.store.get('snippets') as Snippet[] | undefined) ?? []
  }

  saveSnippets(snippets: Snippet[]): void {
    this.store.set('snippets', snippets)
  }

  getTerminalTheme(): string {
    return (this.store.get('terminalTheme') as string | undefined) ?? 'dark'
  }

  setTerminalTheme(theme: string): void {
    this.store.set('terminalTheme', theme)
  }

  getSystemPromptProfiles(): SystemPromptProfile[] {
    return (this.store.get('systemPromptProfiles') as SystemPromptProfile[] | undefined) ?? []
  }

  saveSystemPromptProfile(profile: SystemPromptProfile): void {
    const profiles = this.getSystemPromptProfiles()
    const idx = profiles.findIndex(p => p.id === profile.id)
    if (idx >= 0) profiles[idx] = profile
    else profiles.push(profile)
    this.store.set('systemPromptProfiles', profiles)
  }

  deleteSystemPromptProfile(id: string): void {
    const profiles = this.getSystemPromptProfiles().filter(p => p.id !== id)
    this.store.set('systemPromptProfiles', profiles)
  }

  getTasks(): Task[] {
    return this.store.get('tasks') ?? []
  }

  saveTasks(tasks: Task[]): void {
    this.store.set('tasks', tasks)
  }

  getNotificationSettings(): NotificationSettings {
    return (this.store.get('notificationSettings') as NotificationSettings | undefined) ?? { responseComplete: true, backgroundOnly: true, longSession: false, contextWarning: true }
  }

  setNotificationSettings(s: NotificationSettings): void {
    this.store.set('notificationSettings', s)
  }
}
