import {
  getExpiringItems,
  calculateWasteRisk,
  createWastePlan,
  generateShoppingList,
} from '../tools'

export const toolRegistry = {
  getExpiringItems,

  calculateWasteRisk,

  createWastePlan,

  getPantryItems: (pantryItems) => pantryItems,

  getRecipes: async () => {
    return 'Recipe tool will be implemented in Phase 2'
  },

  generateMealPlan: async () => {
    return 'Meal planner handled by mealPlannerService'
  },

  generateShoppingList,
}
