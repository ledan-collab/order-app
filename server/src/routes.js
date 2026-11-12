import { Router } from 'express'
import { HttpError } from './http.js'
import { changeStock, listMenus } from './menus.js'
import { advanceOrder, createOrder, getOrder, listOrders } from './orders.js'

export const api = Router()

function apiIndex(req, res) {
  res.json({
    message: 'COZY API가 동작 중입니다.',
    menus: '/api/menus',
    orders: '/api/orders',
  })
}

api.get('/', apiIndex)
api.get('', apiIndex)

function readId(value, message) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(404, message)
  }
  return id
}

api.get('/menus', async (req, res) => {
  res.json(await listMenus())
})

api.patch('/menus/:id/stock', async (req, res) => {
  const id = readId(req.params.id, '없는 메뉴입니다.')
  res.json(await changeStock(id, req.body))
})

api.get('/orders', async (req, res) => {
  res.json(await listOrders())
})

api.post('/orders', async (req, res) => {
  res.status(201).json(await createOrder(req.body))
})

api.get('/orders/:id', async (req, res) => {
  const id = readId(req.params.id, '없는 주문입니다.')
  res.json(await getOrder(id))
})

api.patch('/orders/:id', async (req, res) => {
  const id = readId(req.params.id, '없는 주문입니다.')
  res.json(await advanceOrder(id))
})

api.use((req, res) => {
  res.status(404).json({ message: '요청한 API가 없습니다.' })
})
