import { requestGroqChat } from './agent/groqClient'
import { matchRecipes } from './recipes/recipeMatcher'

const asArray = (value) => Array.isArray(value) ? value : []

const parseMealJson = (content) => {
  try {
    const cleanResponse = String(content || '')
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    if (!cleanResponse) return null

    const mealData = JSON.parse(cleanResponse)

    if (!mealData || typeof mealData !== 'object') return null

    return {
      breakfast: mealData.breakfast || '',
      lunch: mealData.lunch || '',
      dinner: mealData.dinner || '',
      reason: mealData.reason || '',
      missingIngredients: asArray(mealData.missingIngredients),
    }
  } catch (e) {
    console.log('JSON PARSE ERROR:', e)
    return null
  }
}

export const generateMealPlanResponse = async (toolResults = {}, language, context = '') => {
  const startedAt = Date.now()
  const expiringItems = asArray(toolResults.expiringItems || toolResults.getExpiringItems)
  const pantryItems = asArray(toolResults.pantryItems || toolResults.getPantryItems)

  const rankedRecipes = matchRecipes({
    pantryItems,
    expiringItems,
    meals: ['Breakfast', 'Lunch', 'Dinner'],
  })

  const topRecipes = rankedRecipes.slice(0, 6)
  const bestRecipeScore = topRecipes[0]?.finalScore || 0

  const availablePantry = pantryItems
    .map(item => item?.name || item)
    .filter(Boolean)

  const candidateSummary = topRecipes
    .map((recipe) => {
      const missingText = recipe.missingIngredients.length > 0
        ? recipe.missingIngredients.join(', ')
        : 'None'

      return `- ${recipe.name} (${recipe.meal}) — Score ${recipe.finalScore} — Availability ${recipe.availabilityScore}% — Missing: ${missingText}`
    })
    .join('\n')

  const planningPrompt = `
You are Ammamma AI.

Goal:
Choose the best practical meal plan from the candidate recipes below.
Do NOT invent recipes.
Do NOT invent ingredients.
Do NOT recommend dishes that need many missing ingredients.
Prefer recipes that use the pantry ingredients already available.

Current pantry context:
${context}

Available pantry ingredients:
${availablePantry.join(', ') || 'No pantry ingredients available.'}

Top candidate recipes:
${candidateSummary || 'No suitable recipes found.'}

Return JSON only with this format:
{
  "breakfast": "",
  "lunch": "",
  "dinner": "",
  "reason": "",
  "missingIngredients": []
}

Rules:
- Choose from the candidate recipes only.
- Prefer recipes with the highest availability first.
- Prefer recipes with the fewest missing ingredients.
- Use practical Indian home-cooked meals.
- If the best available recipe score is below 60, do not invent a full meal plan. Instead return a reason explaining that the pantry does not have enough ingredients for proper meals.
- If the pantry is weak, recommend only a short list of essential groceries that would unlock multiple recipes.
- Prefer practical Indian meals that feel like real home cooking.
- Avoid repetitive or nutritionally weak meals.
- missingIngredients must be an array.
- Return valid JSON only.

${language === 'te'
  ? 'Use Telugu values.'
  : 'Use English values.'}
`

  const result = await requestGroqChat({
    messages: [
      {
        role: 'system',
        content: planningPrompt,
      },
    ],
    maxTokens: 500,
    fallbackMessage: 'Meal planning service is temporarily unavailable.',
  })

  if (!result.ok) {
    return {
      mealData: null,
      reply: result.message || 'Meal planning service is temporarily unavailable.',
      durationMs: Date.now() - startedAt,
      groqDurationMs: result.durationMs,
    }
  }

  const mealData = parseMealJson(result.content)

  if (!mealData) {
    return {
      mealData: null,
      reply: 'Unable to generate meal plan.',
      durationMs: Date.now() - startedAt,
      groqDurationMs: result.durationMs,
    }
  }

  const missingIngredients = asArray(mealData.missingIngredients)
  const shouldSuggestShopping = bestRecipeScore < 60 || missingIngredients.length >= 4
  const essentialGroceries = missingIngredients.slice(0, 8)

  const fallbackReply = `👵 Ammamma's Meal Plan

The pantry does not have enough ingredients for proper meals right now.
I would keep it simple and buy a small set of essentials:
${essentialGroceries.join(', ') || 'basic staples'}

These few items will unlock several practical Indian meals for breakfast, lunch, and dinner.
`

  const reply = shouldSuggestShopping
    ? fallbackReply
    : `👵 Ammamma's Meal Plan

🥣 Breakfast:
${mealData.breakfast}

🍛 Lunch:
${mealData.lunch}

🌙 Dinner:
${mealData.dinner}

💡 Why these recipes were selected:
${mealData.reason}

🛒 Small shopping suggestions:
${essentialGroceries.join(', ') || 'No extra shopping needed'}
`

  return {
    mealData,
    reply,
    durationMs: Date.now() - startedAt,
    groqDurationMs: result.durationMs,
  }
}
