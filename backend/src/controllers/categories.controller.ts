import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../database/connection'

export class CategoriesController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await db('categories').orderBy('name')
      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }
}

export const categoriesController = new CategoriesController()

