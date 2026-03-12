import { ipcMain, dialog } from 'electron'
import { AgentBridge } from '../claude/agent-bridge'
import { AppConfig, PromptTemplate } from '../store/app-config'

export function registerClaudeHandlers(bridge: AgentBridge) {
  ipcMain.on('claude:send', (_, { text, cwd, model, extraSystemPrompt }: { text: string; cwd: string; model: string; extraSystemPrompt?: string }) => {
    const basePrompt = AppConfig.getInstance().getProjectSystemPrompt(cwd)
    const systemPrompt = extraSystemPrompt
      ? [basePrompt, extraSystemPrompt].filter(Boolean).join('\n\n')
      : basePrompt
    bridge.setSystemPrompt(systemPrompt)
    const temperature = AppConfig.getInstance().getTemperature()
    bridge.setTemperature(temperature)
    bridge.sendMessage(text, cwd, model)
  })

  ipcMain.on('claude:interrupt', () => {
    bridge.interrupt()
  })

  ipcMain.on('claude:permission-reply', (_, { requestId, allow, allowSession }: { requestId: string; allow: boolean; allowSession?: boolean }) => {
    bridge.replyPermission(requestId, allow, allowSession)
  })

  ipcMain.on('claude:resume', (_, { sessionId }: { sessionId: string }) => {
    bridge.resumeSession(sessionId)
  })

  ipcMain.on('claude:close', () => {
    bridge.resetSession()
  })

  ipcMain.handle('project:open', async (event) => {
    const win = event.sender.getOwnerBrowserWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Open Project Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    AppConfig.getInstance().setCurrentProject(path)
    return path
  })

  ipcMain.handle('project:recent', () => {
    return AppConfig.getInstance().getRecentProjects()
  })

  ipcMain.handle('project:current', () => {
    return AppConfig.getInstance().getCurrentProject()
  })

  ipcMain.on('project:set', (_, { path }: { path: string }) => {
    AppConfig.getInstance().setCurrentProject(path)
  })

  ipcMain.handle('project:get-workspaces', () => {
    return AppConfig.getInstance().getOpenWorkspaces()
  })

  ipcMain.on('project:set-workspaces', (_, { workspaces, activePath }: { workspaces: Array<{ path: string; openTabs: string[]; activeTab: string }>; activePath: string | null }) => {
    AppConfig.getInstance().setOpenWorkspaces(workspaces, activePath)
  })

  ipcMain.handle('template:list', () => {
    return AppConfig.getInstance().getPromptTemplates()
  })

  ipcMain.handle('template:save', (_, template: PromptTemplate) => {
    AppConfig.getInstance().savePromptTemplate(template)
    return true
  })

  ipcMain.handle('template:delete', (_, id: string) => {
    AppConfig.getInstance().deletePromptTemplate(id)
    return true
  })

  ipcMain.handle('settings:get', () => {
    const config = AppConfig.getInstance()
    return {
      theme: config.getTheme(),
      fontSize: config.getFontSize(),
      maxTokensPerRequest: config.getMaxTokensPerRequest(),
      temperature: config.getTemperature(),
      showTimestamps: config.getShowTimestamps(),
      selectedModel: config.getSelectedModel(),
      accentColor: config.getAccentColor(),
      compactMode: config.getCompactMode(),
      soundEnabled: config.getSoundEnabled(),
      customCSS: config.getCustomCSS(),
    }
  })

  ipcMain.handle('settings:set', (_, patch: Record<string, unknown>) => {
    const config = AppConfig.getInstance()
    if (patch.theme !== undefined) config.setTheme(patch.theme as 'dark' | 'light' | 'system')
    if (patch.fontSize !== undefined) config.setFontSize(patch.fontSize as number)
    if (patch.maxTokensPerRequest !== undefined) config.setMaxTokensPerRequest(patch.maxTokensPerRequest as number)
    if (patch.temperature !== undefined) config.setTemperature(patch.temperature as number)
    if (patch.showTimestamps !== undefined) config.setShowTimestamps(patch.showTimestamps as boolean)
    if (patch.selectedModel !== undefined) config.setSelectedModel(patch.selectedModel as string)
    if (patch.accentColor !== undefined) config.setAccentColor(patch.accentColor as string)
    if (patch.compactMode !== undefined) config.setCompactMode(patch.compactMode as boolean)
    if (patch.soundEnabled !== undefined) config.setSoundEnabled(patch.soundEnabled as boolean)
    if (patch.customCSS !== undefined) config.setCustomCSS(patch.customCSS as string)
    return true
  })

  ipcMain.handle('project:getSystemPrompt', (_, projectPath: string) => {
    return AppConfig.getInstance().getProjectSystemPrompt(projectPath)
  })

  ipcMain.handle('project:setSystemPrompt', (_, { projectPath, prompt }: { projectPath: string; prompt: string }) => {
    AppConfig.getInstance().setProjectSystemPrompt(projectPath, prompt)
    return true
  })

  ipcMain.handle('claude:generateTitle', async (_, { userMessage }: { userMessage: string }) => {
    try {
      const truncated = userMessage.slice(0, 300)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          system: '사용자의 메시지를 보고 대화 제목을 한국어로 5-15자로 생성하세요. 제목만 출력하고 다른 말은 하지 마세요.',
          messages: [{ role: 'user', content: truncated }],
        }),
      })
      const data = await response.json() as { content: Array<{ type: string; text: string }> }
      const raw = data.content?.[0]?.text?.trim() ?? ''
      const title = raw.replace(/^["'「『]|["'」』]$/g, '').trim()
      return title
    } catch {
      return ''
    }
  })

  ipcMain.handle('session:generateTitle', async (_, { userMsg, assistantMsg }: { userMsg: string; assistantMsg: string }) => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 20,
          messages: [{
            role: 'user',
            content: `다음 대화의 제목을 한국어 5단어 이내로 만들어줘. 제목만 출력해:\n\nUser: ${userMsg.slice(0, 200)}\nAssistant: ${assistantMsg.slice(0, 200)}`,
          }],
        }),
      })
      const data = await response.json() as { content: Array<{ type: string; text: string }> }
      return { title: data.content?.[0]?.text?.trim() ?? '' }
    } catch {
      return { title: '' }
    }
  })

  ipcMain.handle('claude:compressContext', async (_, { messages }: { messages: Array<{ role: string; text: string }> }) => {
    try {
      const oldMessages = messages.slice(0, -10)
      const textToSummarize = oldMessages
        .map((m: { role: string; text: string }) => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.text.slice(0, 500)}`)
        .join('\n\n')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `다음 대화를 핵심 정보만 남겨서 한국어로 간결하게 요약해줘. 결정 사항, 코드 변경, 중요 맥락 위주로:\n\n${textToSummarize}`,
          }],
        }),
      })
      const data = await response.json() as { content: Array<{ type: string; text: string }> }
      const summary = data.content?.[0]?.text?.trim() ?? ''
      return { summary, compressedCount: oldMessages.length }
    } catch (e) {
      return { summary: '', compressedCount: 0, error: String(e) }
    }
  })

  ipcMain.handle('claude:explainCode', async (_, { code, language }: { code: string; language: string }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return '❌ API 키가 설정되지 않았습니다.'

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `다음 ${language} 코드를 한국어로 간단하게 설명해줘 (2-4줄):\n\`\`\`${language}\n${code.slice(0, 1000)}\n\`\`\``,
          }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return data.content?.[0]?.text ?? '설명을 가져올 수 없습니다.'
    } catch {
      return '❌ 설명 생성 실패'
    }
  })

  ipcMain.handle('claude:translate', async (_, { text, targetLang }: { text: string; targetLang: 'ko' | 'en' }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return text

    try {
      const prompt = targetLang === 'en'
        ? `Translate the following text to English. Output only the translation:\n\n${text.slice(0, 2000)}`
        : `다음 텍스트를 한국어로 번역해줘. 번역문만 출력해:\n\n${text.slice(0, 2000)}`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return data.content?.[0]?.text ?? text
    } catch {
      return text
    }
  })

  ipcMain.handle('claude:enhancePrompt', async (_, { prompt }: { prompt: string }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return prompt

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `다음 프롬프트를 더 명확하고 구체적으로 개선해줘. 원래 의도를 유지하면서 더 효과적인 프롬프트로 만들어줘. 개선된 프롬프트만 출력해 (설명 없이):\n\n${prompt.slice(0, 1000)}`
          }]
        })
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return data.content?.[0]?.text ?? prompt
    } catch {
      return prompt
    }
  })

  ipcMain.handle('claude:generateInsights', async (_, { totalSessions, totalTokens, avgTokensPerSession, topHours, peakDay, totalDays }: { totalSessions: number; totalTokens: number; avgTokensPerSession: number; topHours: number[]; peakDay: string; totalDays: number }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return '❌ API 키가 설정되지 않았습니다.'

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: '당신은 사용자의 AI 사용 통계를 분석하여 인사이트를 제공하는 어시스턴트입니다. 간결하게 3개의 bullet points로 한국어로 답하세요.',
          messages: [{
            role: 'user',
            content: `총 ${totalSessions}개 세션, ${totalTokens} 토큰 사용, 세션당 평균 ${avgTokensPerSession} 토큰. 피크 시간대: ${topHours.join(', ')}시. 가장 활발한 요일: ${peakDay}. 총 ${totalDays}일 사용.`,
          }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return data.content?.[0]?.text ?? '인사이트를 가져올 수 없습니다.'
    } catch {
      return '❌ 인사이트 생성 실패'
    }
  })

  ipcMain.handle('claude:summarizeSession', async (_, { messages }: { messages: Array<{ role: string; content: string }> }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { summary: '❌ API 키가 설정되지 않았습니다.' }

    try {
      const filtered = messages.filter(m => m.role === 'user' || m.role === 'assistant')
      const conversationText = filtered
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 500)}`)
        .join('\n\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: '당신은 대화 내용을 간결하게 요약하는 어시스턴트입니다. 핵심 주제와 결론을 3-5개 bullet points로 한국어로 요약하세요.',
          messages: [{
            role: 'user',
            content: `다음 대화를 요약해줘:\n\n${conversationText}`,
          }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return { summary: data.content?.[0]?.text ?? '요약을 가져올 수 없습니다.' }
    } catch (e) {
      return { summary: '❌ 요약 생성 실패', error: String(e) }
    }
  })

  ipcMain.handle('claude:generateDocs', async (_, { code, lang }: { code: string; lang: string }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return '❌ API 키가 설정되지 않았습니다.'

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: '당신은 코드 문서화 전문가입니다. 주어진 코드에 JSDoc/docstring 주석을 추가하여 반환하세요. 문서화된 전체 코드만 출력하세요.',
          messages: [{
            role: 'user',
            content: `${lang}\n${code.slice(0, 1500)}`,
          }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      return data.content?.[0]?.text ?? '❌ 문서화 실패'
    } catch {
      return '❌ 문서화 생성 실패'
    }
  })

  ipcMain.handle('claude:suggestFollowUps', async (_, { lastAssistantMsg, lastUserMsg }: { lastAssistantMsg: string; lastUserMsg: string }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return []

    try {
      const truncatedUser = lastUserMsg.slice(0, 300)
      const truncatedAssistant = lastAssistantMsg.slice(0, 300)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: '대화 흐름에 맞는 후속 질문 3개를 한국어로 생성하세요. 각 질문은 한 줄이며, JSON 배열로만 응답하세요. 예: ["질문1", "질문2", "질문3"]',
          messages: [{ role: 'user', content: `사용자: ${truncatedUser}\n어시스턴트: ${truncatedAssistant}` }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      const text = data.content?.[0]?.text?.trim() ?? ''
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed as string[]
      return []
    } catch {
      return []
    }
  })

  ipcMain.handle('claude:suggestSnippets', async (_, { messages }: { messages: Array<{ role: string; content: string }> }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return []

    try {
      const recent = messages.slice(-5)
      const conversationText = recent
        .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content.slice(0, 400)}`)
        .join('\n\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: '대화에서 재사용 가능한 프롬프트 스니펫 3개를 추출하세요. JSON 배열로만 응답하세요: [{"title": "...", "content": "...", "category": "..."}]',
          messages: [{ role: 'user', content: conversationText || '최근 대화 없음' }],
        }),
      })
      const data = await res.json() as { content?: Array<{ text: string }> }
      const text = data.content?.[0]?.text?.trim() ?? ''
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) return parsed as Array<{ title: string; content: string; category: string }>
      return []
    } catch {
      return []
    }
  })

  ipcMain.handle('session:generateTags', async (_, { userMsg, assistantMsg }: { userMsg: string; assistantMsg: string }) => {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          messages: [{
            role: 'user',
            content: `다음 대화의 주제 태그를 2-3개 영어 소문자로 추출해줘. 쉼표로 구분, 태그만 출력:\n\nUser: ${userMsg.slice(0, 200)}\nAssistant: ${assistantMsg.slice(0, 200)}`,
          }],
        }),
      })
      const data = await response.json() as { content: Array<{ type: string; text: string }> }
      const text = data.content?.[0]?.text?.trim() ?? ''
      const tags = text.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(t => t.length > 0 && t.length < 20).slice(0, 3)
      return { tags }
    } catch {
      return { tags: [] }
    }
  })
}
