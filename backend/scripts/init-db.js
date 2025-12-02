#!/usr/bin/env node
'use strict';

// Load environment variables
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Normalize DATABASE_URL before Prisma runs
if (process.env.DATABASE_URL) {
    const originalDbUrl = process.env.DATABASE_URL.trim();
    let dbUrl = originalDbUrl;
    
    // Extract the path part (remove file: prefix if present)
    let dbPath = dbUrl.replace(/^file:\/\//, '').replace(/^file:/, '');
    
    // Check if it's already a file path (ends with .db) or just a directory
    const hasDbExtension = dbPath.endsWith('.db') || dbPath.endsWith('.sqlite') || dbPath.endsWith('.sqlite3');
    
    if (!hasDbExtension) {
        // It's a directory, append database filename
        dbPath = path.join(dbPath, 'database.db');
    }
    
    // Ensure absolute path (handle relative paths)
    if (!path.isAbsolute(dbPath)) {
        dbPath = path.resolve(dbPath);
    }
    
    // Use file:/// format for absolute paths (three slashes after file:)
    if (path.isAbsolute(dbPath)) {
        dbUrl = `file://${dbPath}`;
    } else {
        dbUrl = `file:${dbPath}`;
    }
    
    // Set the normalized URL back to process.env so Prisma can use it
    process.env.DATABASE_URL = dbUrl;
    console.log(`Normalized DATABASE_URL from "${originalDbUrl}" to: ${dbUrl}`);
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
    }
} else {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
}

// Run prisma db push with the normalized DATABASE_URL
try {
    console.log('Running prisma db push...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
        stdio: 'inherit',
        env: process.env
    });
    console.log('Database schema initialized successfully');
} catch (error) {
    console.error('Error initializing database schema:', error.message);
    process.exit(1);
}

