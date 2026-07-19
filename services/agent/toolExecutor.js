import { toolRegistry } from './toolRegistry'

const RESULT_ALIASES = {
  getPantryItems: 'pantryItems',
  getExpiringItems: 'expiringItems',
  calculateWasteRisk: 'risk',
  createWastePlan: 'wastePlan',
  getRecipes: 'recipes',
  generateMealPlan: 'mealPlan',
  generateShoppingList: 'shoppingList',
}

export async function executePlan(plan, context) {
  const startedAt = Date.now()
  const results = {
    executedTools: [],
    failedTools: [],
    toolTimings: {},
  }

  for (const tool of plan.tools || []) {
    const fn = toolRegistry[tool]

    if (!fn) {
      results.failedTools.push(tool)
      results.toolTimings[tool] = 0
      continue
    }

    const toolStartedAt = Date.now()

    try {
      const result = await fn(context.pantryItems)
      const alias = RESULT_ALIASES[tool]

      results[tool] = result

      if (alias) {
        results[alias] = result
      }

      results.executedTools.push(tool)
    } catch (e) {
      console.log(`Tool failed: ${tool}`)
      console.log(e)

      results[tool] = null
      results.failedTools.push(tool)
    } finally {
      results.toolTimings[tool] = Date.now() - toolStartedAt
    }
  }

  results.durationMs = Date.now() - startedAt

  return results
}
