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
import { supportController } from '../controllers/support.controller'
import { auditController } from '../controllers/audit.controller'

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
// Una distribucion mueve stock igual que un egreso: se le exige el mismo rol.
apiRouter.post('/stock/distribution', requireRole('admin', 'supervisor', 'operador'), stockController.createDistribution.bind(stockController))
apiRouter.post('/stock/outbound', requireRole('admin', 'supervisor', 'operador'), stockController.createOutbound.bind(stockController))
apiRouter.get('/movements', requireRole('admin', 'supervisor', 'operador'), stockController.getMovements.bind(stockController))
apiRouter.get('/movements/:id', requireRole('admin', 'supervisor', 'operador'), stockController.getMovement.bind(stockController))

// Beneficiarios
// Contienen datos personales (DNI, domicilio, telefono): la lectura queda para los
// tres roles operativos y la escritura solo para admin y supervisor.
apiRouter.get('/beneficiaries', requireRole('admin', 'supervisor', 'operador'), beneficiariesController.list.bind(beneficiariesController))
apiRouter.get('/beneficiaries/search', requireRole('admin', 'supervisor', 'operador'), stockController.searchBeneficiaries.bind(stockController))
apiRouter.get('/beneficiaries/:id', requireRole('admin', 'supervisor', 'operador'), beneficiariesController.getOne.bind(beneficiariesController))
apiRouter.post('/beneficiaries', requireRole('admin', 'supervisor'), beneficiariesController.create.bind(beneficiariesController))
apiRouter.put('/beneficiaries/:id', requireRole('admin', 'supervisor'), beneficiariesController.update.bind(beneficiariesController))

// Distribuciones
apiRouter.get('/distributions', requireRole('admin', 'supervisor', 'operador'), distributionsController.list.bind(distributionsController))
apiRouter.get('/distributions/:id', requireRole('admin', 'supervisor', 'operador'), distributionsController.getOne.bind(distributionsController))

// Usuarios / Supervisor / Auditoría
apiRouter.get('/users', requireRole('admin'), usersController.list.bind(usersController))
apiRouter.post('/users', requireRole('admin'), usersController.create.bind(usersController))
apiRouter.put('/users/:id', requireRole('admin'), usersController.update.bind(usersController))
apiRouter.get('/audit-logs', requireRole('admin', 'supervisor'), auditController.list.bind(auditController))

// Cierres de inventario
apiRouter.post('/inventory/closing', requireRole('admin', 'supervisor'), stockController.createInventoryClosing.bind(stockController))
apiRouter.get('/inventory/closings', requireRole('admin', 'supervisor', 'operador'), inventoryController.list.bind(inventoryController))
apiRouter.get('/inventory/closings/:id', requireRole('admin', 'supervisor', 'operador'), inventoryController.getOne.bind(inventoryController))

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

// Soporte Técnico
apiRouter.get('/support/meta', supportController.meta.bind(supportController))
apiRouter.get('/support', supportController.list.bind(supportController))
apiRouter.post('/support', supportController.create.bind(supportController))
// El detalle, los mensajes y la actualizacion resuelven la autorizacion en el
// controlador: dependen de quien creo la consulta, no solo del rol. El autor
// puede leer y responder la suya, y reabrirla si fue resuelta o cerrada.
apiRouter.get('/support/:id', supportController.getOne.bind(supportController))
apiRouter.post('/support/:id/mensajes', supportController.addMessage.bind(supportController))
apiRouter.put('/support/:id', supportController.update.bind(supportController))
