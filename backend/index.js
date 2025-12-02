#!/usr/bin/env node
'use strict';

// Load environment variables
require('dotenv').config();

const port = (() => {
    const args = process.argv;

    if (args.length !== 3) {
        console.error("usage: node index.js port");
        process.exit(1);
    }

    const num = parseInt(args[2], 10);
    if (isNaN(num)) {
        console.error("error: argument must be an integer.");
        process.exit(1);
    }

    return num;
})();

const express = require("express");
const cors = require("cors");
const {expressjwt: jwt} = require("express-jwt");
const app = express();

const authRoutes = require("./routes/authRoutes");
const usersRoutes = require("./routes/usersRoutes");
const transactionsRoutes = require("./routes/transactionsRoutes");
const promotionsRoutes = require("./routes/promotionsRoutes");
const eventsRoutes = require("./routes/eventsRoutes");

app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

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