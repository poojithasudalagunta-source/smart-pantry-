const asArray = (value) => Array.isArray(value) ? value : []

export const generateShoppingListResponse = (toolResults = {}, language) => {
  const shoppingList = asArray(toolResults.shoppingList || toolResults.generateShoppingList)
    .filter(Boolean)

  if (shoppingList.length === 0) {
    return {
      shoppingList: [],
      reply: language === 'te'
        ? 'షాపింగ్ లిస్ట్ తయారీ త్వరలో అందుబాటులోకి వస్తుంది.'
        : 'Shopping list generation is coming soon.',
    }
  }

  return {
    shoppingList,
    reply: `🛒 Shopping List\n\n${shoppingList.map(item => `• ${item}`).join('\n')}`,
  }
}
