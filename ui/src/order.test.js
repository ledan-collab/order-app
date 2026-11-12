import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cartQuantity,
  createOrderId,
  formatWon,
  itemLabel,
  stockAfterOrder,
  stockCoversCart,
  stockLabel,
} from './order.js'

test('금액은 천 단위로 구분하고 원을 붙인다', () => {
  assert.equal(formatWon(4500), '4,500원')
  assert.equal(formatWon(0), '0원')
})

test('옵션이 있으면 메뉴 이름 뒤에 붙인다', () => {
  assert.equal(itemLabel({ name: '아메리카노(HOT)', optionNames: [] }), '아메리카노(HOT)')
  assert.equal(
    itemLabel({ name: '아메리카노(ICE)', optionNames: ['샷 추가', '시럽 추가'] }),
    '아메리카노(ICE) (샷 추가, 시럽 추가)',
  )
})

test('재고 상태는 0개 품절, 4개 이하 주의, 5개 이상 정상이다', () => {
  assert.equal(stockLabel(0), '품절')
  assert.equal(stockLabel(1), '주의')
  assert.equal(stockLabel(4), '주의')
  assert.equal(stockLabel(5), '정상')
})

test('같은 메뉴의 다른 옵션은 재고를 함께 센다', () => {
  const cart = [
    { menuId: 'americano-ice', quantity: 1 },
    { menuId: 'americano-ice', quantity: 2 },
    { menuId: 'cafe-latte', quantity: 1 },
  ]
  assert.equal(cartQuantity(cart, 'americano-ice'), 3)
  assert.equal(cartQuantity(cart, 'cafe-latte'), 1)
})

test('담긴 수량이 재고를 넘으면 주문할 수 없다', () => {
  const cart = [{ menuId: 'americano-ice', quantity: 2 }]
  assert.equal(stockCoversCart({ 'americano-ice': 2 }, cart), true)
  assert.equal(stockCoversCart({ 'americano-ice': 1 }, cart), false)
})

test('주문하면 메뉴별 수량만큼 재고가 줄어든다', () => {
  const stock = { 'americano-ice': 10, 'cafe-latte': 10 }
  const cart = [
    { menuId: 'americano-ice', quantity: 1 },
    { menuId: 'americano-ice', quantity: 2 },
  ]
  assert.deepEqual(stockAfterOrder(stock, cart), {
    'americano-ice': 7,
    'cafe-latte': 10,
  })
})

test('주문 id는 매번 다르다', () => {
  assert.notEqual(createOrderId(), createOrderId())
})
