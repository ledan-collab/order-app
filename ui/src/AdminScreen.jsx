import { formatWon, itemLabel, stockLabel } from './order.js'

const STATUS_LABEL = {
  '주문 접수': '주문 접수',
  '제조 중': '제조 중',
  완료: '제조 완료',
}

const NEXT_STATUS = {
  '주문 접수': '제조 중',
  '제조 중': '완료',
}

const ACTION_LABEL = {
  '주문 접수': '제조 시작',
  '제조 중': '제조 완료',
  완료: '제조 완료',
}

function formatOrderTime(value) {
  const date = new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${hours}:${minutes}`
}

function orderSummary(order) {
  return order.items.map((item) => `${itemLabel(item)} x ${item.quantity}`).join(', ')
}

export default function AdminScreen({ menus, orders, stock, onChangeStock, onAdvanceOrder }) {
  const counts = [
    { label: '총 주문', value: orders.length },
    { label: '주문 접수', value: orders.filter((order) => order.status === '주문 접수').length },
    { label: '제조 중', value: orders.filter((order) => order.status === '제조 중').length },
    { label: '제조 완료', value: orders.filter((order) => order.status === '완료').length },
  ]

  return (
    <main className="admin">
      <section className="admin-section" aria-label="관리자 대시보드">
        <h2 className="admin-section-title">관리자 대시보드</h2>
        <div className="admin-section-body">
        <div className="stat-list">
          {counts.map((item) => (
            <article key={item.label} className="stat-card">
              <p className="stat-label">{item.label}</p>
              <p className="stat-value">{item.value}</p>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section className="admin-section" aria-label="재고 현황">
        <h2 className="admin-section-title">재고 현황</h2>
        <div className="admin-section-body">
        <div className="stock-list">
          {menus.map((menu) => {
            const count = stock[menu.id]
            const label = stockLabel(count)
            return (
              <article key={menu.id} className="stock-card">
                <h3 className="stock-name">{menu.name}</h3>
                <div className="stock-meta">
                  <span className="stock-amount">{count}개</span>
                  <span className={`stock-state stock-state-${label}`}>{label}</span>
                </div>
                <div className="stock-actions">
                  <button
                    type="button"
                    className="qty-button"
                    aria-label={`${menu.name} 재고 늘리기`}
                    onClick={() => onChangeStock(menu.id, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="qty-button"
                    aria-label={`${menu.name} 재고 줄이기`}
                    disabled={count === 0}
                    onClick={() => onChangeStock(menu.id, -1)}
                  >
                    −
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        </div>
      </section>

      <section className="admin-section order-section" aria-label="주문 현황">
        <h2 className="admin-section-title">주문 현황</h2>
        <div className="admin-section-body">
        {orders.length === 0 ? (
          <p className="empty-orders">접수된 주문이 없습니다.</p>
        ) : (
          <ul className="order-list">
            {orders.map((order) => {
              const summary = orderSummary(order)
              const canAdvance = Boolean(NEXT_STATUS[order.status])
              return (
                <li key={order.id} className="order-row">
                  <span className="order-time">{formatOrderTime(order.orderedAt)}</span>
                  <span className="order-summary">{summary}</span>
                  <span className="order-price">{formatWon(order.total)}</span>
                  <span className="order-status">{STATUS_LABEL[order.status]}</span>
                  <button
                    type="button"
                    className="button order-action"
                    disabled={!canAdvance}
                    onClick={() => onAdvanceOrder(order.id)}
                  >
                    {ACTION_LABEL[order.status]}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        </div>
      </section>
    </main>
  )
}
