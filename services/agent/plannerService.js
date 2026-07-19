import {
  DEFAULT_TOOLS_BY_INTENT,
  fallbackPlan,
  isCanonicalIntent,
} from './intentConstants'
import { requestGroqChat } from './groqClient'

const ALLOWED_TOOLS = new Set([
  'getPantryItems',
  'getExpiringItems',
  'getRecipes',
  'generateMealPlan',
  'generateShoppingList',
  'calculateWasteRisk',
])

const validatePlan = (plan) => {
  if (!plan || typeof plan !== 'object') {
    return fallbackPlan('Planner returned empty output')
  }

  if (!isCanonicalIntent(plan.intent)) {
    return fallbackPlan('Planner returned an unknown intent')
  }

  if (!Array.isArray(plan.tools) || plan.tools.length === 0) {
    return fallbackPlan('Planner returned missing tools')
  }

  const validTools = plan.tools.filter(tool => ALLOWED_TOOLS.has(tool))

  if (validTools.length !== plan.tools.length || validTools.length === 0) {
    return fallbackPlan('Planner returned invalid tools')
  }

  if (typeof plan.confidence !== 'number') {
    return fallbackPlan('Planner returned missing confidence')
  }

  return {
    intent: plan.intent,
    tools: validTools,
    confidence: plan.confidence,
    reason: plan.reason || 'Planner selected an intent.',
  }
}

export async function createPlan(message) {
  const systemPrompt = `
You are the Planning Engine for Smart Pantry.

DO NOT answer the user.

Your job is ONLY to decide:

1. intent
2. tools
3. confidence
4. reason

Allowed intents:
- expiry_check
- meal_plan
- shopping_list
- general_chat

Available tools:
- getPantryItems
- getExpiringItems
- getRecipes
- generateMealPlan
- generateShoppingList
- calculateWasteRisk

Rules:
- Return one canonical intent only.
- Do not return aliases like expiry, shopping, recipe, waste, or chat.
- tools must be a non-empty array.
- confidence must be a number.
- Return ONLY valid JSON.

Example:

{
  "intent":"meal_plan",
  "tools":[
    "getPantryItems",
    "getExpiringItems",
    "calculateWasteRisk",
    "generateMealPlan"
  ],
  "confidence":0.98,
  "reason":"User wants today's meals using pantry ingredients."
}
`;

  const result = await requestGroqChat({
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    temperature: 0,
    maxTokens: 200,
    fallbackMessage: 'Planning service is temporarily unavailable.',
  })

  if (!result.ok) {
    console.log('Planner Error', result.message)
    return {
      ...fallbackPlan(result.message),
      durationMs: result.durationMs,
    }
  }

  try {
    const parsedPlan = JSON.parse(result.content)
    const validatedPlan = validatePlan(parsedPlan)

    return {
      ...validatedPlan,
      tools: validatedPlan.tools || DEFAULT_TOOLS_BY_INTENT[validatedPlan.intent],
      durationMs: result.durationMs,
    }
  } catch (err) {
    console.log('Planner JSON Error', err)

    return {
      ...fallbackPlan('Planner returned invalid JSON'),
      durationMs: result.durationMs,
    }
  }
}
