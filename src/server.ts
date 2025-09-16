import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono<{
  Bindings: {
    TODO_KV: KVNamespace
  }
}>()

interface Task {
  id: number
  task: string
  completed: boolean
  createdAt?: string
}

// Habilita CORS para todas as rotas
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Permite origens locais do frontend
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Funções auxiliares para persistência com KV
const getTasks = async (c: any) => {
  try {
    const tasksData = await c.env.TODO_KV.get('tasks')
    return tasksData ? JSON.parse(tasksData) : []
  } catch (error) {
    console.error('Erro ao carregar tarefas:', error)
    return []
  }
}

const saveTasks = async (c: any, tasks: any[]) => {
  try {
    await c.env.TODO_KV.put('tasks', JSON.stringify(tasks))
  } catch (error) {
    console.error('Erro ao salvar tarefas:', error)
  }
}

// Rota para listar tarefas
app.get('/api/todos', async (c) => {
  const tasks = await getTasks(c)
  return c.json({ success: true, data: tasks })
})

// Rota para adicionar tarefa
app.post('/api/todos', async (c) => {
  try {
    const body = await c.req.json()

    // Validação básica
    if (!body.task || typeof body.task !== 'string' || body.task.trim() === '') {
      return c.json({
        success: false,
        error: 'O campo "task" é obrigatório e deve ser uma string não vazia'
      }, 400)
    }

    const newTask = {
      id: Date.now(),
      task: body.task.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }

    const tasks = await getTasks(c)
    tasks.push(newTask)
    await saveTasks(c, tasks)

    return c.json({ success: true, data: newTask }, 201)

  } catch (error) {
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 400)
  }
})

// Rota para atualizar tarefa
app.put('/api/todos/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.json()

    const tasks = await getTasks(c)
    const taskIndex = tasks.findIndex((task: Task) => task.id === id)

    if (taskIndex === -1) {
      return c.json({
        success: false,
        error: 'Tarefa não encontrada'
      }, 404)
    }

    // Atualiza apenas os campos fornecidos
    if (body.task !== undefined) {
      if (typeof body.task !== 'string' || body.task.trim() === '') {
        return c.json({
          success: false,
          error: 'O campo "task" deve ser uma string não vazia'
        }, 400)
      }
      tasks[taskIndex].task = body.task.trim()
    }

    if (body.completed !== undefined) {
      tasks[taskIndex].completed = Boolean(body.completed)
    }

    await saveTasks(c, tasks)
    return c.json({ success: true, data: tasks[taskIndex] })

  } catch (error) {
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 400)
  }
})

// Rota para deletar tarefa
app.delete('/api/todos/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const tasks = await getTasks(c)
    const taskIndex = tasks.findIndex((task: Task) => task.id === id)

    if (taskIndex === -1) {
      return c.json({
        success: false,
        error: 'Tarefa não encontrada'
      }, 404)
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0]
    await saveTasks(c, tasks)
    return c.json({ success: true, data: deletedTask })

  } catch (error) {
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 400)
  }
})



export default app
