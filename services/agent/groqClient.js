const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 20000
const RETRY_DELAY_MS = 800

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const friendlyMessageForStatus = (status, fallbackMessage) => {
  switch (status) {
    case 401:
    case 403:
      return 'AI service authentication needs attention.'
    case 429:
      return 'AI service is busy right now. Please try again shortly.'
    case 500:
      return fallbackMessage || 'AI service is temporarily unavailable.'
    default:
      return fallbackMessage || 'AI service is temporarily unavailable.'
  }
}

const parseJsonSafely = async (response) => {
  try {
    return await response.json()
  } catch (e) {
    return null
  }
}

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export const requestGroqChat = async ({
  messages,
  model = 'llama-3.3-70b-versatile',
  maxTokens = 500,
  temperature,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fallbackMessage = 'AI service is temporarily unavailable.',
}) => {
  const startedAt = Date.now()
  let retried = false

  const runRequest = async () => fetchWithTimeout(
    GROQ_CHAT_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        ...(temperature === undefined ? {} : { temperature }),
      }),
    },
    timeoutMs
  )

  try {
    let response = await runRequest()

    if (response.status === 429) {
      retried = true
      await wait(RETRY_DELAY_MS)
      response = await runRequest()
    }

    const data = await parseJsonSafely(response)
    const durationMs = Date.now() - startedAt

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        content: '',
        retried,
        durationMs,
        message: friendlyMessageForStatus(response.status, fallbackMessage),
      }
    }

    const content = data?.choices?.[0]?.message?.content || ''

    if (!data || !content.trim()) {
      return {
        ok: false,
        status: response.status,
        data,
        content: '',
        retried,
        durationMs,
        message: fallbackMessage,
      }
    }

    return {
      ok: true,
      status: response.status,
      data,
      content,
      retried,
      durationMs,
      message: '',
    }
  } catch (e) {
    const durationMs = Date.now() - startedAt
    const isTimeout = e?.name === 'AbortError'

    return {
      ok: false,
      status: 0,
      data: null,
      content: '',
      retried,
      durationMs,
      message: isTimeout
        ? 'AI service request timed out. Please try again.'
        : fallbackMessage,
    }
  }
}
