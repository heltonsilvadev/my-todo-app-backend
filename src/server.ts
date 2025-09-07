// src/server.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

// Nosso "banco de dados" temporário
const tasks = [
  { id: 1, task: 'Escovar os dentes' },
  { id: 2, task: 'Estudar Vue.js' }
]

// Rota para listar tarefas
app.get('/api/todos', (c) => {
  return c.json(tasks)
})

// Rota para adicionar tarefa (exemplo simplificado)
app.post('/api/todos', async (c) => {
  const body = await c.req.json()
  const newTask = { id: Date.now(), task: body.task }
  tasks.push(newTask)
  return c.json(newTask)
})

// Inicia o servidor
serve({ fetch: app.fetch })