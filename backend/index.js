#!/usr/bin/env node
'use strict';

// Load environment variables
require('dotenv').config();

const port = (() => {
    // Railway and other cloud platforms provide PORT via environment variable
    if (process.env.PORT) {
        const num = parseInt(process.env.PORT, 10);
        if (!isNaN(num) && num > 0) {
            console.log(`Using PORT from environment: ${num}`);
            return num;
        }
        console.warn(`Invalid PORT environment variable: ${process.env.PORT}`);
    }

    // Fallback to command-line argument for local development
    const args = process.argv;
    if (args.length === 3) {
        const num = parseInt(args[2], 10);
        if (!isNaN(num) && num > 0) {
            console.log(`Using PORT from command line: ${num}`);
            return num;
        }
        console.error("error: argument must be a positive integer.");
        process.exit(1);
    }

    // Default port for local development
    console.warn("No PORT specified, using default port 3000");
    return 3000;
})();

// Normalize DATABASE_URL for SQLite (important for Railway volumes)
const fs = require('fs');
const path = require('path');

if (process.env.DATABASE_URL) {
    const originalDbUrl = process.env.DATABASE_URL.trim();
    let dbUrl = originalDbUrl;
    
    // Extract the path part (remove file: prefix if present)
    let dbPath = dbUrl.replace(/^file:\/\//, '').replace(/^file:/, '');
    
    // Check if it's already a file path (ends with .db) or just a directory
    const hasDbExtension = dbPath.endsWith('.db') || dbPath.endsWith('.sqlite') || dbPath.endsWith('.sqlite3');
    
    if (!hasDbExtension) {
        // It's a directory, append database filename
        dbPath = path.join(dbUrl, 'database.db');
    }
    
    // Ensure absolute path (handle relative paths)
    if (!path.isAbsolute(dbPath)) {
        dbPath = path.resolve(dbPath);
    }
    
    // Use file:/// format for absolute paths (three slashes after file:)
    // For SQLite: file:///absolute/path or file:./relative/path
    if (path.isAbsolute(dbPath)) {
        dbUrl = `file://${dbPath}`;
    } else {
        dbUrl = `file:${dbPath}`;
    }
    
    if (dbUrl !== originalDbUrl) {
        process.env.DATABASE_URL = dbUrl;
    }
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (dbDir && dbDir !== '.' && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const {expressjwt: jwt} = require("express-jwt");
const app = express();

// Load routes with error handling
let authRoutes, usersRoutes, transactionsRoutes, promotionsRoutes, eventsRoutes;
try {
    authRoutes = require("./routes/authRoutes");
    usersRoutes = require("./routes/usersRoutes");
    transactionsRoutes = require("./routes/transactionsRoutes");
    promotionsRoutes = require("./routes/promotionsRoutes");
    eventsRoutes = require("./routes/eventsRoutes");
} catch (error) {
    console.error('Error loading routes:', error);
}

// CORS configuration - use environment variable or default to localhost for development
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:5173'];

// Validate required environment variables
if (!process.env.JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is not set');
    setTimeout(() => {
        process.exit(1);
    }, 100);
}

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

app.use(cookieParser()); // Parse cookies from requests
app.use(express.json());

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// JWT middleware - reads token from httpOnly cookie or Authorization header (for backward compatibility)
app.use(jwt({
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
    getToken: (req) => {
        // First try to get token from httpOnly cookie
        if (req.cookies && req.cookies.token) {
            return req.cookies.token;
        }
        // Fallback to Authorization header (for backward compatibility during migration)
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
            return req.headers.authorization.split(' ')[1];
        }
        return null;
    }
}).unless({
    path: [
        "/health",
        "/auth/tokens",
        "/auth/logout",
        "/auth/resets",
        /^\/auth\/resets\/[^/]+$/,
        {url: "/users", method: ["POST"]}
        ]
    })
);

// ADD YOUR WORK HERE
// ROUTES
if (authRoutes) app.use("/auth", authRoutes);
if (usersRoutes) app.use("/users", usersRoutes);
if (transactionsRoutes) app.use("/transactions", transactionsRoutes);
if (promotionsRoutes) app.use("/promotions", promotionsRoutes);
if (eventsRoutes) app.use("/events", eventsRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit immediately, let the server try to handle it
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

server.on('error', (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
});