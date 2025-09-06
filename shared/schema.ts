import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  role: text("role").default("user").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Tabla para almacenar las imágenes generadas por los usuarios
export const stencils = pgTable("stencils", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  imageUrl: text("image_url").notNull(),
  originalImageUrl: text("original_image_url"),
  lineColor: text("line_color").default("red").notNull(),
  transparentBackground: boolean("transparent_background").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStencilSchema = createInsertSchema(stencils).pick({
  userId: true,
  imageUrl: true,
  originalImageUrl: true,
  lineColor: true,
  transparentBackground: true,
});

export type InsertStencil = z.infer<typeof insertStencilSchema>;
export type Stencil = typeof stencils.$inferSelect;
