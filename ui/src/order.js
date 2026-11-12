export function formatWon(amount) {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function itemLabel(item) {
  if (item.optionNames.length === 0) {
    return item.name
  }
  return `${item.name} (${item.optionNames.join(', ')})`
}

export function stockLabel(count) {
  if (count === 0) {
    return '품절'
  }
  if (count < 5) {
    return '주의'
  }
  return '정상'
}

export function cartQuantity(cart, menuId) {
  return cart.reduce(
    (sum, item) => (item.menuId === menuId ? sum + item.quantity : sum),
    0,
  )
}

export function stockCoversCart(stock, cart) {
  const menuIds = new Set(cart.map((item) => item.menuId))
  for (const menuId of menuIds) {
    if (cartQuantity(cart, menuId) > stock[menuId]) {
      return false
    }
  }
  return true
}

export function stockAfterOrder(stock, cart) {
  const next = { ...stock }
  for (const item of cart) {
    next[item.menuId] -= item.quantity
  }
  return next
}

export function createOrderId() {
  return crypto.randomUUID()
}

export const ACTION_LABEL = {
  received: '제조 시작',
  making: '제조 완료',
  done: '제조 완료',
}
