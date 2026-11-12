import { useState } from 'react'
import AdminScreen from './AdminScreen.jsx'
import { MENUS, OPTIONS } from './menus.js'
import {
  cartQuantity,
  createOrderId,
  formatWon,
  itemLabel,
  stockAfterOrder,
  stockCoversCart,
  stockLabel,
} from './order.js'
import './App.css'

function App() {
  const [screen, setScreen] = useState('order')
  const [selectedByMenu, setSelectedByMenu] = useState(() =>
    Object.fromEntries(MENUS.map((menu) => [menu.id, []])),
  )
  const [cart, setCart] = useState([])
  const [orders, setOrders] = useState([])
  const [stock, setStock] = useState(() =>
    Object.fromEntries(MENUS.map((menu) => [menu.id, 10])),
  )
  const [notice, setNotice] = useState('')

  function toggleOption(menuId, optionId) {
    setSelectedByMenu((current) => {
      const selected = current[menuId]
      const nextIds = selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId]
      const ordered = OPTIONS.filter((option) => nextIds.includes(option.id)).map(
        (option) => option.id,
      )
      return { ...current, [menuId]: ordered }
    })
  }

  function addToCart(menu) {
    if (cartQuantity(cart, menu.id) >= stock[menu.id]) {
      return
    }
    const selectedIds = selectedByMenu[menu.id]
    const selectedOptions = OPTIONS.filter((option) => selectedIds.includes(option.id))
    const key = `${menu.id}:${selectedOptions.map((option) => option.id).join('+')}`
    const unitPrice =
      menu.price + selectedOptions.reduce((sum, option) => sum + option.price, 0)

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
  }

  function placeOrder() {
    if (cart.length === 0 || !stockCoversCart(stock, cart)) {
      return
    }
    const items = cart.map((item) => ({
      ...item,
      linePrice: item.unitPrice * item.quantity,
    }))
    const orderTotal = items.reduce((sum, item) => sum + item.linePrice, 0)
    setOrders((current) => [
      {
        id: createOrderId(),
        orderedAt: new Date().toISOString(),
        items,
        total: orderTotal,
        status: 'received',
      },
      ...current,
    ])
    setStock(stockAfterOrder(stock, cart))
    setCart([])
    setNotice('주문이 접수되었습니다.')
  }

  function changeStock(menuId, delta) {
    setStock((current) => {
      const next = current[menuId] + delta
      if (next < 0) {
        return current
      }
      return { ...current, [menuId]: next }
    })
  }

  function advanceOrder(orderId) {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) {
          return order
        }
        if (order.status === 'received') {
          return { ...order, status: 'making' }
        }
        if (order.status === 'making') {
          return { ...order, status: 'done' }
        }
        return order
      }),
    )
  }

  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const canOrder = cart.length > 0 && stockCoversCart(stock, cart)

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

      {screen === 'order' ? (
        <main>
          <section className="panel menu-section" aria-label="메뉴">
            <h2 className="section-title">메뉴</h2>
            <div className="menu-list">
            {MENUS.map((menu) => {
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
                  {OPTIONS.map((option) => {
                    const inputId = `${menu.id}-${option.id}`
                    return (
                      <label key={option.id} className="option" htmlFor={inputId}>
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selectedByMenu[menu.id].includes(option.id)}
                          onChange={() => toggleOption(menu.id, option.id)}
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
              {cart.length > 0 && !canOrder ? (
                <p className="cart-warning">담긴 수량이 재고보다 많아 주문할 수 없습니다.</p>
              ) : null}
            </div>
            <div className="cart-summary">
              <p className="cart-total">
                총 금액 <strong>{formatWon(total)}</strong>
              </p>
              <button
                type="button"
                className="button"
                disabled={!canOrder}
                onClick={placeOrder}
              >
                주문하기
              </button>
            </div>
          </section>
        </main>
      ) : (
        <AdminScreen
          menus={MENUS}
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
