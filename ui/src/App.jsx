import { useEffect, useState } from 'react'
import AdminScreen from './AdminScreen.jsx'
import { normalizeOrder, request } from './api.js'
import { cartQuantity, formatWon, itemLabel, stockCoversCart, stockLabel } from './order.js'
import './App.css'

function App() {
  const [screen, setScreen] = useState('order')
  const [menus, setMenus] = useState([])
  const [selectedByMenu, setSelectedByMenu] = useState({})
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const stock = Object.fromEntries(menus.map((menu) => [menu.id, menu.stock]))

  async function refresh() {
    const [menuList, orderList] = await Promise.all([
      request('/api/menus'),
      request('/api/orders'),
    ])
    setMenus(menuList)
    setOrders(orderList.map(normalizeOrder))
    setSelectedByMenu((current) => {
      const next = { ...current }
      for (const menu of menuList) {
        if (!next[menu.id]) {
          next[menu.id] = []
        }
      }
      return next
    })
  }

  useEffect(() => {
    let ignore = false
    refresh()
      .catch((loadError) => {
        if (!ignore) {
          setError(loadError.message)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [])

  function toggleOption(menu, optionId) {
    setSelectedByMenu((current) => {
      const selected = current[menu.id] ?? []
      const nextIds = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId]
      const ordered = menu.options
        .filter((option) => nextIds.includes(option.id))
        .map((option) => option.id)
      return { ...current, [menu.id]: ordered }
    })
  }

  function addToCart(menu) {
    if (cartQuantity(cart, menu.id) >= stock[menu.id]) {
      return
    }
    const selectedIds = selectedByMenu[menu.id] ?? []
    const selectedOptions = menu.options.filter((option) => selectedIds.includes(option.id))
    const key = `${menu.id}:${selectedOptions.map((option) => option.id).join('+')}`
    const unitPrice = menu.price + selectedOptions.reduce((sum, option) => sum + option.price, 0)

    setCart((current) => {
      if (cartQuantity(current, menu.id) >= stock[menu.id]) {
        return current
      }
      const index = current.findIndex((item) => item.key === key)
      if (index === -1) {
        return [
          ...current,
          {
            key,
            menuId: menu.id,
            optionIds: selectedOptions.map((option) => option.id),
            name: menu.name,
            optionNames: selectedOptions.map((option) => option.name),
            unitPrice,
            quantity: 1,
          },
        ]
      }
      return current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item,
      )
    })
    setSelectedByMenu((current) => ({ ...current, [menu.id]: [] }))
    setNotice('')
    setError('')
  }

  function changeQuantity(key, delta) {
    setCart((current) => {
      const target = current.find((item) => item.key === key)
      if (!target) {
        return current
      }
      if (delta > 0 && cartQuantity(current, target.menuId) >= stock[target.menuId]) {
        return current
      }
      return current.flatMap((item) => {
        if (item.key !== key) {
          return [item]
        }
        const quantity = item.quantity + delta
        if (quantity < 1) {
          return []
        }
        return [{ ...item, quantity }]
      })
    })
    setNotice('')
    setError('')
  }

  async function placeOrder() {
    if (cart.length === 0 || !stockCoversCart(stock, cart) || submitting) {
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({
            menuId: item.menuId,
            optionIds: item.optionIds,
            quantity: item.quantity,
          })),
        }),
      })
      setCart([])
      setNotice('주문이 접수되었습니다.')
      await refresh()
    } catch (orderError) {
      setError(orderError.message)
      if (orderError.status === 409) {
        await refresh().catch(() => {})
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function changeStock(menuId, delta) {
    try {
      const menu = await request(`/api/menus/${menuId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ delta }),
      })
      setMenus((current) => current.map((item) => (item.id === menu.id ? menu : item)))
      setError('')
    } catch (stockError) {
      setError(stockError.message)
    }
  }

  async function advanceOrder(orderId) {
    try {
      const order = normalizeOrder(
        await request(`/api/orders/${orderId}`, {
          method: 'PATCH',
        }),
      )
      setOrders((current) => current.map((item) => (item.id === order.id ? order : item)))
      setError('')
    } catch (statusError) {
      setError(statusError.message)
    }
  }

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const canOrder = cart.length > 0 && stockCoversCart(stock, cart) && !submitting

  return (
    <div className="app">
      <header className="header">
        <p className="brand">COZY</p>
        <nav className="nav" aria-label="화면 이동">
          <button
            type="button"
            className={screen === 'order' ? 'nav-button active' : 'nav-button'}
            aria-current={screen === 'order' ? 'page' : undefined}
            onClick={() => setScreen('order')}
          >
            주문하기
          </button>
          <button
            type="button"
            className={screen === 'admin' ? 'nav-button active' : 'nav-button'}
            aria-current={screen === 'admin' ? 'page' : undefined}
            onClick={() => setScreen('admin')}
          >
            관리자
          </button>
        </nav>
      </header>

      {error ? (
        <p className="load-error" role="alert">
          {error}
        </p>
      ) : null}

      {screen === 'order' ? (
        <main>
          <section className="panel menu-section" aria-label="메뉴">
            <h2 className="section-title">메뉴</h2>
            {loading ? (
              <p className="empty-cart">메뉴를 불러오는 중입니다.</p>
            ) : (
              <div className="menu-list">
                {menus.map((menu) => {
                  const count = stock[menu.id]
                  const label = stockLabel(count)
                  const reserved = cartQuantity(cart, menu.id)
                  const canAdd = reserved < count
                  return (
                    <article key={menu.id} className="menu-card">
                      <img className="menu-image" src={menu.image} alt={menu.name} />
                      <h3 className="menu-name">{menu.name}</h3>
                      <p className="menu-price">{formatWon(menu.price)}</p>
                      <div className="menu-stock">
                        <span className="stock-amount">{count}개</span>
                        <span className={`stock-state stock-state-${label}`}>{label}</span>
                      </div>
                      <p className="menu-desc">{menu.description}</p>
                      <div className="options">
                        {menu.options.map((option) => {
                          const inputId = `${menu.id}-${option.id}`
                          return (
                            <label key={option.id} className="option" htmlFor={inputId}>
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={(selectedByMenu[menu.id] ?? []).includes(option.id)}
                                onChange={() => toggleOption(menu, option.id)}
                              />
                              <span>
                                {option.name} (+{option.price.toLocaleString('ko-KR')}원)
                              </span>
                            </label>
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        className="button"
                        disabled={!canAdd}
                        onClick={() => addToCart(menu)}
                      >
                        담기
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {notice ? (
            <p className="order-notice" role="status">
              {notice}
            </p>
          ) : null}

          <section className="cart" aria-label="장바구니">
            <h2 className="cart-title">장바구니</h2>
            <div className="cart-body">
              {cart.length === 0 ? (
                <p className="empty-cart">장바구니가 비어 있습니다.</p>
              ) : (
                <ul className="cart-items">
                  {cart.map((item) => {
                    const label = itemLabel(item)
                    const canIncrease = cartQuantity(cart, item.menuId) < stock[item.menuId]
                    return (
                      <li key={item.key} className="cart-item">
                        <span className="cart-item-name">{label}</span>
                        <div className="qty-control">
                          <button
                            type="button"
                            className="qty-button"
                            aria-label={`${label} 하나 빼기`}
                            onClick={() => changeQuantity(item.key, -1)}
                          >
                            −
                          </button>
                          <span className="qty-value">{item.quantity}</span>
                          <button
                            type="button"
                            className="qty-button"
                            aria-label={`${label} 하나 더하기`}
                            disabled={!canIncrease}
                            onClick={() => changeQuantity(item.key, 1)}
                          >
                            +
                          </button>
                        </div>
                        <span className="cart-line-price">
                          {formatWon(item.unitPrice * item.quantity)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {cart.length > 0 && !stockCoversCart(stock, cart) ? (
                <p className="cart-warning">담긴 수량이 재고보다 많아 주문할 수 없습니다.</p>
              ) : null}
            </div>
            <div className="cart-summary">
              <p className="cart-total">
                총 금액 <strong>{formatWon(total)}</strong>
              </p>
              <button type="button" className="button" disabled={!canOrder} onClick={placeOrder}>
                주문하기
              </button>
            </div>
          </section>
        </main>
      ) : (
        <AdminScreen
          menus={menus}
          orders={orders}
          stock={stock}
          onChangeStock={changeStock}
          onAdvanceOrder={advanceOrder}
        />
      )}
    </div>
  )
}

export default App
