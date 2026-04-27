import { Router } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth.middleware'
import { authController } from '../controllers/auth.controller'
import { stockController } from '../controllers/stock.controller'
import { itemsController } from '../controllers/items.controller'
import { beneficiariesController } from '../controllers/beneficiaries.controller'
import { distributionsController } from '../controllers/distributions.controller'
import { inventoryController } from '../controllers/inventory.controller'
import { categoriesController } from '../controllers/categories.controller'
import { excelController } from '../controllers/excel.controller'
import { upload } from '../middleware/upload.middleware'
import { alertsController } from '../controllers/alerts.controller'
import { statisticsController } from '../controllers/statistics.controller'
import { usersController } from '../controllers/users.controller'

export const apiRouter = Router()

// Auth (público)
apiRouter.post('/auth/login', authController.login.bind(authController))

// Rutas protegidas
apiRouter.use(authMiddleware)

apiRouter.get('/auth/me', authController.me.bind(authController))

apiRouter.get('/categories', categoriesController.list.bind(categoriesController))

// Ítems
apiRouter.get('/items', stockController.getItems.bind(stockController))
apiRouter.post('/items', requireRole('admin', 'supervisor'), itemsController.create.bind(itemsController))
apiRouter.put('/items/:id', requireRole('admin', 'supervisor'), itemsController.update.bind(itemsController))
apiRouter.get('/items/:id', itemsController.getOne.bind(itemsController))
apiRouter.delete('/items/:id', requireRole('admin', 'supervisor'), itemsController.delete.bind(itemsController))

// Movimientos
apiRouter.post('/stock/ingreso', requireRole('admin', 'supervisor'), stockController.createIngreso.bind(stockController))
apiRouter.post('/stock/distribution', stockController.createDistribution.bind(stockController))
apiRouter.post('/stock/outbound', requireRole('admin', 'supervisor', 'operador'), stockController.createOutbound.bind(stockController))
apiRouter.get('/movements', stockController.getMovements.bind(stockController))
apiRouter.get('/movements/:id', stockController.getMovement.bind(stockController))

// Beneficiarios
apiRouter.get('/beneficiaries', beneficiariesController.list.bind(beneficiariesController))
apiRouter.get('/beneficiaries/search', stockController.searchBeneficiaries.bind(stockController))
apiRouter.get('/beneficiaries/:id', beneficiariesController.getOne.bind(beneficiariesController))
apiRouter.post('/beneficiaries', beneficiariesController.create.bind(beneficiariesController))
apiRouter.put('/beneficiaries/:id', beneficiariesController.update.bind(beneficiariesController))

// Distribuciones
apiRouter.get('/distributions', distributionsController.list.bind(distributionsController))
apiRouter.get('/distributions/:id', distributionsController.getOne.bind(distributionsController))

// Usuarios / Supervisor
apiRouter.get('/users', requireRole('admin'), usersController.list.bind(usersController))
apiRouter.post('/users', requireRole('admin'), usersController.create.bind(usersController))
apiRouter.put('/users/:id', requireRole('admin'), usersController.update.bind(usersController))

// Cierres de inventario
apiRouter.post('/inventory/closing', requireRole('admin', 'supervisor'), stockController.createInventoryClosing.bind(stockController))
apiRouter.get('/inventory/closings', inventoryController.list.bind(inventoryController))
apiRouter.get('/inventory/closings/:id', inventoryController.getOne.bind(inventoryController))

// Alertas y estadísticas
apiRouter.get('/alerts', requireRole('admin', 'supervisor', 'operador'), alertsController.list.bind(alertsController))
apiRouter.post('/alerts/:itemId/:type/ack', requireRole('admin', 'supervisor'), alertsController.acknowledge.bind(alertsController))
apiRouter.get('/statistics/stock-by-category', requireRole('admin', 'supervisor', 'operador'), statisticsController.stockByCategory.bind(statisticsController))
apiRouter.get('/statistics/movements', requireRole('admin', 'supervisor', 'operador'), statisticsController.movements.bind(statisticsController))
apiRouter.get('/statistics/dashboard', requireRole('admin', 'supervisor'), statisticsController.dashboardSummary.bind(statisticsController))
apiRouter.get('/statistics/health', requireRole('admin', 'supervisor'), statisticsController.inventoryHealth.bind(statisticsController))
apiRouter.get('/statistics/movements-by-type', requireRole('admin', 'supervisor'), statisticsController.movementsByType.bind(statisticsController))

// Excel import/export
apiRouter.get('/export/items.xlsx', requireRole('admin', 'supervisor'), excelController.exportItems.bind(excelController))
apiRouter.post('/import/items', requireRole('admin', 'supervisor'), upload.single('file'), excelController.importItems.bind(excelController))
apiRouter.get('/export/beneficiaries.xlsx', requireRole('admin', 'supervisor'), excelController.exportBeneficiaries.bind(excelController))
apiRouter.post('/import/beneficiaries', requireRole('admin', 'supervisor'), upload.single('file'), excelController.importBeneficiaries.bind(excelController))
apiRouter.get('/export/movements.xlsx', requireRole('admin', 'supervisor'), excelController.exportMovements.bind(excelController))
apiRouter.get('/export/inventory-health.xlsx', requireRole('admin', 'supervisor', 'operador'), excelController.exportInventoryHealth.bind(excelController))
