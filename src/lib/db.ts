import initSqlJs, { Database } from 'sql.js';

interface LogEntry {
  timestamp: number;
  operation: string;
  sql: string;
}

export class DB {
  private db: Database;
  private logs: LogEntry[];

  // Constructor to initialize the database with a name and logs
  private constructor(SQL: initSqlJs.SqlJsStatic) {
    this.db = new SQL.Database(); // Create a new SQLite database in memory
    this.logs = [];           // Initialize the logs array
  }

  // Open a database (creates an empty database in memory for this example)
  static async openDB(): Promise<DB> {
    const SQL = await initSqlJs();
    const instance = new DB(SQL);
    return instance;
  }

  // Run SQL statement(s) and log the operation
  async exec(stmt: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const results = this.db.exec(stmt);
    if (results.length === 0) return [];

    // Log the operation
    this.logs.push({
      timestamp: Date.now(),
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

    // Optionally, you might need to load logs if you have them in the dump
  }

  // Merge another database dump into this one
  async merge(dump: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const SQL = await initSqlJs();
    const tempDB = new SQL.Database(new Uint8Array(dump.split('').map(c => c.charCodeAt(0))));

    // Attach the temporary database to the current one
    this.db.run('ATTACH DATABASE ":memory:" AS temp_db');
    this.db.run('CREATE TABLE IF NOT EXISTS temp_db.sqlite_master AS SELECT * FROM temp_db.sqlite_master');
    this.db.run('INSERT INTO temp_db.sqlite_master SELECT * FROM temp_db.sqlite_master');

    // Merge tables from temp_db to the main database
    const tables = tempDB.exec('SELECT name FROM sqlite_master WHERE type="table";');
    for (const table of tables[0].values) {
      const tableName = table[0];
      this.db.run(`ATTACH DATABASE ":memory:" AS temp_db`);
      this.db.run(`CREATE TABLE IF NOT EXISTS ${tableName} AS SELECT * FROM temp_db.${tableName}`);
      this.db.run(`INSERT INTO ${tableName} SELECT * FROM temp_db.${tableName}`);
    }
    this.db.run('DETACH DATABASE temp_db');
  }

  // Get the current logs
  getLogs(): LogEntry[] {
    return this.logs;
  }

  // Sync with another database using logs
  async syncWith(otherLogs: LogEntry[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Compare logs
    const myLogs = this.getLogs();

    // Find new operations in the other database that are not in the current one
    const newLogs = otherLogs.filter(log => !myLogs.some(myLog => myLog.timestamp === log.timestamp && myLog.sql === log.sql));

    // Apply new operations
    for (const log of newLogs) {
      await this.exec(log.sql);
    }
  }
}
