export const getExpiringItems = (items) => {
  return items.filter(item => {
    if (!item.expiry_date) return false

    const days =
      Math.ceil(
        (new Date(item.expiry_date) - new Date())
        / (1000 * 60 * 60 * 24)
      )

    return days <= 3 && days >= 0
  })
}
export const getExpiredItems = (items) => {
  return items.filter(item => {
    if (!item.expiry_date) return false

    const days =
      Math.ceil(
        (new Date(item.expiry_date) - new Date())
        / (1000 * 60 * 60 * 24)
      )

    return days < 0
  })
}
export const calculateWasteRisk = (items) => {
  const expiring =
    getExpiringItems(items)

 if (
  expiring.some(item => {
    const days = Math.ceil(
      (new Date(item.expiry_date) - new Date()) /
      (1000 * 60 * 60 * 24)
    )

    return days <= 1
  })
) {
  return 'HIGH'
}

if (expiring.length >= 3)
  return 'MEDIUM'

return 'LOW'
}

export const createWastePlan = (items) => {
  const expiring = items.filter(item => {
    if (!item.expiry_date) return false

    const days = Math.ceil(
      (new Date(item.expiry_date) - new Date()) /
      (1000 * 60 * 60 * 24)
    )

    return days <= 3 && days >= 0
  })

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

