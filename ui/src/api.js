const apiBase = import.meta.env.VITE_API_URL=https://order-app-backend-9fls.onrender.com

export async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    const error = new Error('서버에 연결하지 못했습니다.')
    error.status = 0
    throw error
  }

  const body = await response.json()
  if (!response.ok) {
    const error = new Error(body.message || '요청을 처리하지 못했습니다.')
    error.status = response.status
    throw error
  }
  return body
}

export function normalizeOrder(order) {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      name: item.menuName,
    })),
  }
}
