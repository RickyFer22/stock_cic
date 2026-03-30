import { Request, Response, NextFunction } from 'express'
import { db } from '../database/connection'

export class CategoriesController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await db('categories').orderBy('name')
      res.json({ data: rows })
    } catch (err) { next(err) }
  }
}
export const categoriesController = new CategoriesController()
