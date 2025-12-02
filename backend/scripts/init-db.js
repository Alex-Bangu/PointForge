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
(async () => {
    try {
        console.log('Running prisma db push...');
        execSync('npx prisma db push --skip-generate --accept-data-loss', {
            stdio: 'inherit',
            env: process.env
        });
        console.log('Database schema initialized successfully');
        
        // Check if database has any users by querying it
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        try {
            const userCount = await prisma.user.count();
            console.log(`Found ${userCount} users in database`);
            console.log(`SEED_DATABASE environment variable: ${process.env.SEED_DATABASE || 'not set'}`);
            
            if (userCount === 0 && process.env.SEED_DATABASE === 'true') {
                console.log('Database is empty and SEED_DATABASE=true, running seed script...');
                console.log(`Using DATABASE_URL: ${process.env.DATABASE_URL}`);
                try {
                    execSync('node prisma/seed.mjs', {
                        stdio: 'inherit',
                        env: process.env,
                        cwd: process.cwd()
                    });
                    
                    // Verify users were created
                    const newUserCount = await prisma.user.count();
                    if (newUserCount > 0) {
                        console.log(`✅ Database seeded successfully! Created ${newUserCount} users.`);
                        console.log('Test users created. Login with:');
                        console.log('  Superuser: utorid=supersu1, password=Password123!');
                        console.log('  Manager: utorid=manager1, password=Password123!');
                        console.log('  Regular: utorid=reguser1, password=Password123!');
                    } else {
                        console.error('❌ Seed script completed but no users were created!');
                        console.error('This might indicate the seed script failed silently.');
                    }
                } catch (seedError) {
                    console.error('❌ Seed script failed:', seedError.message);
                    console.error('Full error:', seedError);
                    console.error('You can create a user manually using: node prisma/createsu.js <utorid> <email> <password>');
                }
            } else if (userCount === 0) {
                console.log('');
                console.log('⚠️  Database is empty (no users found). To seed with test data:');
                console.log('   1. Set SEED_DATABASE=true in Railway environment variables');
                console.log('   2. Redeploy the service');
                console.log('');
                console.log('   Or create a user manually:');
                console.log('   node prisma/createsu.js <utorid> <email> <password>');
                console.log('   Or register through the frontend registration page');
            }
        } catch (checkError) {
            console.warn('Could not check user count:', checkError.message);
        } finally {
            await prisma.$disconnect();
        }
    } catch (error) {
        console.error('Error initializing database schema:', error.message);
        process.exit(1);
    }
})();

