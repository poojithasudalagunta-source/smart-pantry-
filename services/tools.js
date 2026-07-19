const MS_PER_DAY = 1000 * 60 * 60 * 24

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null

  return Math.ceil(
    (new Date(expiryDate) - new Date()) / MS_PER_DAY
  )
}

const withExpiryMetadata = (item) => ({
  ...item,
  daysUntilExpiry: getDaysUntilExpiry(item.expiry_date),
})

export const getExpiringItems = (items = []) => {
  return (Array.isArray(items) ? items : [])
    .map(withExpiryMetadata)
    .filter(item => {
      if (item.daysUntilExpiry === null) return false

      return item.daysUntilExpiry <= 3 && item.daysUntilExpiry >= 0
    })
}

export const getExpiredItems = (items = []) => {
  return (Array.isArray(items) ? items : [])
    .map(withExpiryMetadata)
    .filter(item => {
      if (item.daysUntilExpiry === null) return false

      return item.daysUntilExpiry < 0
    })
}

export const calculateWasteRisk = (items = []) => {
  const expiring = getExpiringItems(items)

  if (expiring.some(item => item.daysUntilExpiry <= 1)) {
    return 'HIGH'
  }

  if (expiring.length >= 3) {
    return 'MEDIUM'
  }

  return 'LOW'
}

export const createWastePlan = (items = []) => {
  const expiring = getExpiringItems(items)

  return {
    risk:
      expiring.length >= 5
        ? 'HIGH'
        : expiring.length >= 2
        ? 'MEDIUM'
        : 'LOW',

    expiringItems: expiring,
  }
}

export const generateShoppingList = (items = []) => {
  const shoppingList = []

  ;(Array.isArray(items) ? items : []).forEach(item => {
    const qty = Number(item.quantity)

    if (!isNaN(qty) && qty <= 1) {
      shoppingList.push(item.name)
    }
  })

  return shoppingList
}
