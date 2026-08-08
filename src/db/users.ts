import { db } from './index';
import { users, datasets, analysisReports, promptRoutines } from './schema';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || email.split('@')[0],
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Error syncing user to Cloud SQL:', error);
    throw new Error('Failed to synchronize user record', { cause: error });
  }
}

export async function saveDatasetRecord(userId: string, fileName: string, rowCount: number, columnCount: number, content?: string) {
  try {
    const result = await db.insert(datasets)
      .values({
        userId,
        fileName,
        rowCount,
        columnCount,
        content: content ? content.substring(0, 500000) : '',
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error saving dataset to Cloud SQL:', error);
    throw new Error('Failed to save dataset', { cause: error });
  }
}

export async function getUserDatasets(userId: string) {
  try {
    return await db.select().from(datasets).where(eq(datasets.userId, userId)).orderBy(desc(datasets.createdAt));
  } catch (error) {
    console.error('Error fetching datasets from Cloud SQL:', error);
    throw new Error('Failed to fetch datasets', { cause: error });
  }
}

export async function saveReportRecord(userId: string, question: string, reportTitle: string, reportJson: any) {
  try {
    const result = await db.insert(analysisReports)
      .values({
        userId,
        question,
        reportTitle,
        reportJson: typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson),
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error saving report to Cloud SQL:', error);
    throw new Error('Failed to save report', { cause: error });
  }
}

export async function getUserReports(userId: string) {
  try {
    return await db.select().from(analysisReports).where(eq(analysisReports.userId, userId)).orderBy(desc(analysisReports.createdAt));
  } catch (error) {
    console.error('Error fetching reports from Cloud SQL:', error);
    throw new Error('Failed to fetch reports', { cause: error });
  }
}

export async function savePromptRoutineRecord(userId: string, title: string, description: string, category: string, promptText: string) {
  try {
    const result = await db.insert(promptRoutines)
      .values({
        userId,
        title,
        description,
        category: category || 'General',
        promptText,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error saving routine to Cloud SQL:', error);
    throw new Error('Failed to save prompt routine', { cause: error });
  }
}

export async function getUserRoutines(userId: string) {
  try {
    return await db.select().from(promptRoutines).where(eq(promptRoutines.userId, userId)).orderBy(desc(promptRoutines.createdAt));
  } catch (error) {
    console.error('Error fetching routines from Cloud SQL:', error);
    throw new Error('Failed to fetch prompt routines', { cause: error });
  }
}
