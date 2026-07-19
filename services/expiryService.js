const asArray = (value) => Array.isArray(value) ? value : []

export const generateExpiryResponse = (toolResults = {}) => {
  const expiringItems = asArray(toolResults.expiringItems || toolResults.getExpiringItems)
  const risk = toolResults.risk || toolResults.calculateWasteRisk || 'LOW'

  const actionText = expiringItems
    .map(item => {
      const name = item?.name || 'Unnamed item'
      const days = typeof item?.daysUntilExpiry === 'number'
        ? item.daysUntilExpiry
        : null

      if (days !== null && days <= 1) {
        return `• ${name}: Use today or tomorrow`
      }

      if (days !== null && days <= 3) {
        return `• ${name}: Prioritize this week`
      }

      return `• ${name}: Monitor usage`
    })
    .join('\n')

  if (expiringItems.length === 0) {
    return '✅ No items are expiring soon. Waste risk is LOW.'
  }

  return `🎯 Goal: Reduce food waste

⚠ Waste Risk: ${risk}

📦 Expiring Items:
${expiringItems.map(i => `• ${i?.name || 'Unnamed item'}`).join('\n')}

🚀 Recommended Action:
${actionText}`
}
