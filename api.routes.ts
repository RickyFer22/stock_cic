import { Router } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.middleware'
import { authController }  from '../controllers/auth.controller'
import { stockController } from '../controllers/stock.controller'
import { itemsController } from '../controllers/items.controller'
import { beneficiariesController } from '../controllers/beneficiaries.controller'
import { distributionsController } from '../controllers/distributions.controller'
import { inventoryController } from '../controllers/inventory.controller'
import { categoriesController } from '../controllers/categories.controller'

export const apiRouter = Router()

// ── Auth (público) ────────────────────────────────────────────────────────────
apiRouter.post('/auth/login', authController.login.bind(authController))

// ── Rutas protegidas ──────────────────────────────────────────────────────────
apiRouter.use(authMiddleware)

// Auth
apiRouter.get('/auth/me', authController.me.bind(authController))

// Categorías
apiRouter.get('/categories', categoriesController.list.bind(categoriesController))

// Ítems / Stock
apiRouter.get ('/items',         stockController.getItems.bind(stockController))
apiRouter.post('/items',         requireRole('admin', 'supervisor'), itemsController.create.bind(itemsController))
apiRouter.put ('/items/:id',     requireRole('admin', 'supervisor'), itemsController.update.bind(itemsController))
apiRouter.get ('/items/:id',     itemsController.getOne.bind(itemsController))

// Movimientos de stock
apiRouter.post('/stock/ingreso',      requireRole('admin', 'supervisor'), stockController.createIngreso.bind(stockController))
apiRouter.post('/stock/distribution', stockController.createDistribution.bind(stockController))
apiRouter.get ('/movements',          stockController.getMovements.bind(stockController))

// Beneficiarios
apiRouter.get ('/beneficiaries',        beneficiariesController.list.bind(beneficiariesController))
apiRouter.get ('/beneficiaries/search', stockController.searchBeneficiaries.bind(stockController))
apiRouter.get ('/beneficiaries/:id',    beneficiariesController.getOne.bind(beneficiariesController))
apiRouter.post('/beneficiaries',        beneficiariesController.create.bind(beneficiariesController))
apiRouter.put ('/beneficiaries/:id',    beneficiariesController.update.bind(beneficiariesController))

// Distribuciones
apiRouter.get('/distributions',     distributionsController.list.bind(distributionsController))
apiRouter.get('/distributions/:id', distributionsController.getOne.bind(distributionsController))

// Cierre de inventario
apiRouter.post('/inventory/closing',     requireRole('admin', 'supervisor'), stockController.createInventoryClosing.bind(stockController))
apiRouter.get ('/inventory/closings',    inventoryController.list.bind(inventoryController))
apiRouter.get ('/inventory/closings/:id', inventoryController.getOne.bind(inventoryController))
