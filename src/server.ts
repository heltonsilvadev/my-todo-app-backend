import { Hono, Context } from 'hono'
import { cors } from 'hono/cors'
import { KVNamespace } from '@cloudflare/workers-types'
import { serve } from '@hono/node-server'

const app = new Hono<{
  Bindings: {
    TODO_KV: KVNamespace
  }
}>()

interface Task {
  id: string
  task: string
  completed: boolean
  createdAt: string
}

type AppContext = Context<{
  Bindings: {
    TODO_KV: KVNamespace
  }
}>

// Habilita CORS para todas as rotas
// AVISO: Em produção, considere restringir origins a domínios específicos para segurança
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Armazenamento local em memória para desenvolvimento local
let localTasks: Task[] = []

// Função auxiliar para gerar ID único
const generateId = (): string => {
  return crypto.randomUUID()
}

// Funções auxiliares para persistência
const getTasks = async (c: AppContext): Promise<Task[]> => {
  // Verifica se é produção (Cloudflare Workers) ou desenvolvimento local
  if (c?.env?.TODO_KV) {
    try {
      const tasksData = await c.env.TODO_KV.get('tasks')
      return tasksData ? JSON.parse(tasksData) : []
    } catch (error) {
      console.error('Erro ao carregar tarefas KV:', error)
      throw new Error('Failed to load tasks from KV')
    }
  } else {
    // Desenvolvimento local: usar armazenamento em memória
    return localTasks
  }
}

const saveTasks = async (c: AppContext, tasks: Task[]): Promise<void> => {
  if (c?.env?.TODO_KV) {
    try {
      await c.env.TODO_KV.put('tasks', JSON.stringify(tasks))
    } catch (error) {
      console.error('Erro ao salvar tarefas KV:', error)
      throw new Error('Failed to save tasks to KV')
    }
  } else {
    // Desenvolvimento local
    localTasks = tasks
  }
}

// Rota para listar tarefas
app.get('/api/todos', async (c) => {
  try {
    const tasks = await getTasks(c)
    return c.json({ success: true, data: tasks })
  } catch (error) {
    console.error('Erro no GET /api/todos:', error)
    return c.json({
      success: false,
      error: 'Erro ao listar tarefas'
    }, 500)
  }
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
      id: generateId(),
      task: body.task.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    }

    const tasks = await getTasks(c)
    tasks.push(newTask)
    await saveTasks(c, tasks)

    return c.json({ success: true, data: newTask }, 201)

  } catch (error) {
    console.error('Erro no POST /api/todos:', error)
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 500)
  }
})

// Rota para atualizar tarefa
app.put('/api/todos/:id', async (c) => {
  try {
    const id = c.req.param('id')
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
      if (typeof body.completed !== 'boolean') {
        return c.json({
          success: false,
          error: 'O campo "completed" deve ser um booleano'
        }, 400)
      }
      tasks[taskIndex].completed = body.completed
    }

    await saveTasks(c, tasks)
    return c.json({ success: true, data: tasks[taskIndex] })

  } catch (error) {
    console.error('Erro no PUT /api/todos/:id:', error)
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 500)
  }
})

// Rota para deletar tarefa
app.delete('/api/todos/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const isUsingKV = !!c?.env?.TODO_KV
    console.log(`DELETE /api/todos/${id} - Using KV: ${isUsingKV}`)

    const tasks = await getTasks(c)
    console.log(`Tasks retrieved: ${tasks.length} items`)

    const taskIndex = tasks.findIndex((task: Task) => task.id === id)
    console.log(`Task index found: ${taskIndex}, ID: ${id}`)

    if (taskIndex === -1) {
      console.log('Task not found')
      return c.json({
        success: false,
        error: 'Tarefa não encontrada'
      }, 404)
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0]
    console.log(`Task deleted: ${deletedTask.id}`)

    await saveTasks(c, tasks)
    console.log(`Tasks saved, remaining: ${tasks.length}`)

    return c.json({ success: true, data: deletedTask })

  } catch (error) {
    console.error('Erro no DELETE /api/todos/:id:', error)
    return c.json({
      success: false,
      error: 'Erro ao processar a requisição'
    }, 500)
  }
})

// Execução local para desenvolvimento
if ((globalThis as any).process?.argv.includes('--serve')) {
  const port = process.env.PORT || 3001
  console.log(`🚀 Servidor rodando em http://localhost:${port}`)
  console.log(`📚 API disponível em http://localhost:${port}/api/todos`)

  serve({
    fetch: app.fetch,
    port: Number(port),
  })
}

export default app
