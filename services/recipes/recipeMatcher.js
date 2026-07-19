import { basicRecipes } from './basicRecipes'

const normalizeIngredient = (ingredient = '') => String(ingredient).trim().toLowerCase()

const normalizeIngredients = (ingredients = []) =>
  ingredients
    .map(normalizeIngredient)
    .filter(Boolean)

const getIngredientFrequency = (items = []) => {
  const counts = new Map()

  for (const item of items) {
    const normalized = normalizeIngredient(item?.name || item)
    if (!normalized) continue
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }

  return counts
}

export const calculateAvailability = ({ pantryItems = [], recipeIngredients = [] }) => {
  const pantryInventory = getIngredientFrequency(pantryItems)
  const normalizedRecipeIngredients = normalizeIngredients(recipeIngredients)

  const availableIngredients = normalizedRecipeIngredients.filter((ingredient) => pantryInventory.has(ingredient))
  const missingIngredients = normalizedRecipeIngredients.filter((ingredient) => !pantryInventory.has(ingredient))

  const availabilityScore = normalizedRecipeIngredients.length > 0
    ? Math.round((availableIngredients.length / normalizedRecipeIngredients.length) * 100)
    : 100

  return {
    availableIngredients,
    missingIngredients,
    availabilityScore,
  }
}

const trivialRecipeNames = new Set(['plain rice', 'boiled rice', 'toast with jam', 'fruit bowl', 'curd snack', 'roasted chana', 'banana chips'])

const getRecipePenalty = (recipe) => {
  const name = String(recipe?.name || '').toLowerCase()
  const penalty = trivialRecipeNames.has(name) ? 25 : 0
  const isVerySimple = (recipe?.minimumIngredients || 0) <= 1
  const simplePenalty = isVerySimple ? 12 : 0
  return penalty + simplePenalty
}

export const scoreRecipe = ({ pantryItems = [], expiringItems = [], recipe }) => {
  const normalizedRecipeIngredients = normalizeIngredients(recipe?.ingredients || [])
  const { availableIngredients, missingIngredients, availabilityScore } = calculateAvailability({
    pantryItems,
    recipeIngredients: normalizedRecipeIngredients,
  })

  const normalizedExpiringItems = new Set(
    normalizeIngredients(expiringItems.map((item) => item?.name || item))
  )

  const expiringIngredientMatches = normalizedRecipeIngredients.filter((ingredient) => normalizedExpiringItems.has(ingredient))
  const qualityScore = Number(recipe?.qualityScore || 0)
  const missingPenalty = missingIngredients.length * 6
  const finalScore = availabilityScore + qualityScore * 0.5 + expiringIngredientMatches.length * 8 - missingPenalty - getRecipePenalty(recipe)

  return {
    ...recipe,
    availableIngredients,
    missingIngredients,
    availabilityScore,
    qualityScore,
    finalScore,
    expiringIngredientMatches,
  }
}

export const matchRecipes = ({ pantryItems = [], expiringItems = [], meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] } = {}) => {
  const normalizedMeals = meals.map((meal) => String(meal).trim())
  const candidates = basicRecipes
    .filter((recipe) => normalizedMeals.includes(recipe.meal))
    .map((recipe) => scoreRecipe({ pantryItems, expiringItems, recipe }))
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) {
        return right.finalScore - left.finalScore
      }

      if (right.availabilityScore !== left.availabilityScore) {
        return right.availabilityScore - left.availabilityScore
      }

      if (left.missingIngredients.length !== right.missingIngredients.length) {
        return left.missingIngredients.length - right.missingIngredients.length
      }

      if (right.qualityScore !== left.qualityScore) {
        return right.qualityScore - left.qualityScore
      }

      return left.name.localeCompare(right.name)
    })

  return candidates.slice(0, 6)
}
