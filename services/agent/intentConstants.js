export const AGENT_INTENTS = {
  EXPIRY_CHECK: 'expiry_check',
  MEAL_PLAN: 'meal_plan',
  SHOPPING_LIST: 'shopping_list',
  GENERAL_CHAT: 'general_chat',
}

export const CANONICAL_INTENTS = Object.values(AGENT_INTENTS)

export const isCanonicalIntent = (intent) => CANONICAL_INTENTS.includes(intent)

export const DEFAULT_TOOLS_BY_INTENT = {
  [AGENT_INTENTS.EXPIRY_CHECK]: [
    'getExpiringItems',
    'calculateWasteRisk',
  ],
  [AGENT_INTENTS.MEAL_PLAN]: [
    'getPantryItems',
    'getExpiringItems',
    'calculateWasteRisk',
    'generateMealPlan',
  ],
  [AGENT_INTENTS.SHOPPING_LIST]: [
    'getPantryItems',
    'generateShoppingList',
  ],
  [AGENT_INTENTS.GENERAL_CHAT]: [
    'getPantryItems',
    'getExpiringItems',
    'getRecipes',
  ],
}

export const fallbackPlan = (reason = 'Planner output was invalid') => ({
  intent: AGENT_INTENTS.GENERAL_CHAT,
  tools: DEFAULT_TOOLS_BY_INTENT[AGENT_INTENTS.GENERAL_CHAT],
  confidence: 0,
  reason,
})
