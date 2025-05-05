import { db } from './db';
import { users, stencils, type User, type InsertUser, type Stencil, type InsertStencil } from '@shared/schema';
import { eq } from 'drizzle-orm';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { pool } from './db';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  saveStencil(stencil: InsertStencil): Promise<Stencil>;
  getUserStencils(userId: number): Promise<Stencil[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async saveStencil(stencil: InsertStencil): Promise<Stencil> {
    const [savedStencil] = await db.insert(stencils).values(stencil).returning();
    return savedStencil;
  }

  async getUserStencils(userId: number): Promise<Stencil[]> {
    return db.select().from(stencils).where(eq(stencils.userId, userId)).orderBy(stencils.createdAt);
  }
}

export const storage = new DatabaseStorage();
