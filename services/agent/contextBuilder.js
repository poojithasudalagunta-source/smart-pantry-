export function buildContext(toolResults) {
  const pantryItems = toolResults.pantryItems || toolResults.getPantryItems || []
  const expiringItems = toolResults.expiringItems || toolResults.getExpiringItems || []
  const recipes = toolResults.recipes || toolResults.getRecipes || ''
  const risk = toolResults.risk || toolResults.calculateWasteRisk || 'UNKNOWN'

  return `
Pantry Items:
${JSON.stringify(pantryItems, null, 2)}

Expiring Items:
${JSON.stringify(expiringItems, null, 2)}

Waste Risk:
${risk}

Recipe Context:
${recipes}
`;
}
