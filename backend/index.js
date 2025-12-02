#!/usr/bin/env node
'use strict';

// Load environment variables
require('dotenv').config();

const port = (() => {
    // Railway and other cloud platforms provide PORT via environment variable
    if (process.env.PORT) {
        const num = parseInt(process.env.PORT, 10);
        if (!isNaN(num)) {
            return num;
        }
    }

    // Fallback to command-line argument for local development
    const args = process.argv;
    if (args.length === 3) {
        const num = parseInt(args[2], 10);
        if (!isNaN(num)) {
            return num;
        }
        console.error("error: argument must be an integer.");
        process.exit(1);
    }

    // If neither is provided, show usage
    console.error("usage: node index.js port (or set PORT environment variable)");
    process.exit(1);
})();

// Normalize DATABASE_URL for SQLite (important for Railway volumes)
const fs = require('fs');
const path = require('path');

if (process.env.DATABASE_URL) {
    const originalDbUrl = process.env.DATABASE_URL.trim();
    let dbUrl = originalDbUrl;
    
    // If DATABASE_URL doesn't start with 'file:', normalize it
    if (!dbUrl.startsWith('file:')) {
        // Check if it's already a file path (ends with .db) or just a directory
        let dbPath = dbUrl;
        if (!dbPath.endsWith('.db') && !dbPath.endsWith('.sqlite') && !dbPath.endsWith('.sqlite3')) {
            // It's a directory, append database filename
            dbPath = path.join(dbUrl, 'database.db');
        }
        // Ensure absolute path (handle relative paths)
        if (!path.isAbsolute(dbPath)) {
            dbPath = path.resolve(dbPath);
        }
        dbUrl = `file:${dbPath}`;
        process.env.DATABASE_URL = dbUrl;
        console.log(`Normalized DATABASE_URL from "${originalDbUrl}" to: ${dbUrl}`);
    }
    
    // Ensure database directory exists
    const dbPath = dbUrl.replace(/^file:/, '');
    const dbDir = path.dirname(dbPath);
    if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`Created database directory: ${dbDir}`);
    }
    
    console.log(`Database will be stored at: ${dbPath}`);
}

const express = require("express");
const cors = require("cors");
const {expressjwt: jwt} = require("express-jwt");
const app = express();

const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const transactionsRoutes = require("./routes/transactionsRoutes");
const promotionsRoutes = require("./routes/promotionsRoutes");
const eventsRoutes = require("./routes/eventsRoutes");

// CORS configuration - use environment variable or default to localhost for development
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173'];

console.log('CORS allowed origins:', allowedOrigins);
console.log('Environment:', process.env.NODE_ENV || 'development');

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        // Normalize origin (remove trailing slash)
        const normalizedOrigin = origin.replace(/\/$/, '');
        const normalizedAllowed = allowedOrigins.map(o => o.replace(/\/$/, ''));
        
        // In production, also allow Railway frontend domains if CORS_ORIGIN is not explicitly set
        const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
        if (isProduction && !process.env.CORS_ORIGIN) {
            // Allow any Railway frontend service
            if (normalizedOrigin.includes('.up.railway.app') || normalizedOrigin.includes('.railway.app')) {
                console.log(`CORS allowing Railway origin: ${origin}`);
                return callback(null, true);
            }
        }
        
        if (normalizedAllowed.includes(normalizedOrigin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin} (allowed: ${normalizedAllowed.join(', ')})`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

app.options('*', cors()); // allow preflight globally

app.use(express.json());
app.use(jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
}).unless({
    path: [
        "/auth/tokens",
        "/auth/resets",
        /^\/auth\/resets\/[^/]+$/,
        {url: "/users", method: ["POST"]}
        ]
    })
);

// ADD YOUR WORK HERE
// ROUTES
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/transactions", transactionsRoutes)
app.use("/promotions", promotionsRoutes)
app.use("/events", eventsRoutes)

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
});