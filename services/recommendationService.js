export const getPriorityItems = (pantryItems) => {
  const today = new Date()

  return pantryItems
    .filter(item => item.expiry_date)
    .map(item => {
      const daysLeft = Math.ceil(
        (new Date(item.expiry_date) - today) /
        (1000 * 60 * 60 * 24)
      )

      return {
        ...item,
        daysLeft,
      }
    })
    .filter(item => item.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export const getPriorityIngredientNames = (
  pantryItems,
  limit = 5
) => {
  return getPriorityItems(pantryItems)
    .slice(0, limit)
    .map(item => item.name)
}

export const buildRecipePrompt = (
  pantryItems,
  language = 'en'
) => {
  const priorityIngredients =
    getPriorityIngredientNames(pantryItems)

  return `
You are Ammamma AI.

Goal:
Reduce food waste.

Priority ingredients:
${priorityIngredients.join(', ')}

Create 5 recipes.

Rules:
- Prioritize expiring ingredients.
- Indian recipes preferred.
- Mention missing ingredients separately.
- Return concise results.

${language === 'te'
  ? 'Respond in Telugu.'
  : 'Respond in English.'}
`
}