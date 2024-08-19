import initSqlJs, { Database } from 'sql.js';

interface LogEntry {
  timestamp: number;
  operation: string;
  sql: string;
}

export class DB {
  private ts: number;   //timestamp for logs
  private db: Database;
  private logs: LogEntry[];

  // Constructor to initialize the database with a name and logs
  private constructor(SQL: initSqlJs.SqlJsStatic) {
    this.db = new SQL.Database(); // Create a new SQLite database in memory
    this.logs = [];           // Initialize the logs array
    this.ts = 0;
  }

  // Open a database (creates an empty database in memory for this example)
  static async openDB(): Promise<DB> {
    const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
    const instance = new DB(SQL);
    return instance;
  }

  // Run SQL statement(s) and log the operation
  async exec(stmt: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const results = this.db.exec(stmt);
    if (results.length === 0) return [];

    this.logs.push({
      timestamp: this.ts++,
      operation: 'exec',
      sql: stmt
    });

    return results[0].values;
  }

  // Save database state to SQL dump
  save(): string {
    if (!this.db) throw new Error('Database not initialized');
    const dump = this.db.export();
    return dump.toString();
  }

  // Load SQL dump into the database
  async load(dump: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const SQL = await initSqlJs();
    const newDB = new SQL.Database(new Uint8Array(dump.split('').map(c => c.charCodeAt(0))));
    this.db = newDB;
  }

  // Get the current logs
  getLogs(): LogEntry[] { return this.logs; }

  // Sync with another database using logs
  // assume the differences only appears at the end of logs
  async syncWith(otherLogs: LogEntry[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const myLogs = this.getLogs();
    const latest_other = Math.max(...otherLogs.map(item => item.timestamp))
    const latest_my = Math.max(...myLogs.map(item => item.timestamp))

    if (latest_other > latest_my) for (const log of otherLogs) {
      if (log.timestamp > latest_my)
        await this.exec(log.sql);
    }
  }
}
