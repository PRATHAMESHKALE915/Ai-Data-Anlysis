import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const datasets = pgTable('datasets', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(), // Firebase UID or user reference
  fileName: text('file_name').notNull(),
  rowCount: integer('row_count').default(0),
  columnCount: integer('column_count').default(0),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const analysisReports = pgTable('analysis_reports', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  question: text('question').notNull(),
  reportTitle: text('report_title'),
  reportJson: text('report_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const pivotConfigs = pgTable('pivot_configs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  configJson: text('config_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const promptRoutines = pgTable('prompt_routines', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').default('General'),
  promptText: text('prompt_text').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  datasets: many(datasets),
  reports: many(analysisReports),
  routines: many(promptRoutines),
}));
