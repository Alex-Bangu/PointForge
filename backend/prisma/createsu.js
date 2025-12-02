/*
 * Complete this script so that it is able to add a superuser to the database
 * Usage example: 
 *   node prisma/createsu.js clive123 clive.su@mail.utoronto.ca SuperUser123!
 */
'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

async function main() {
    const args = process.argv.slice(2);
    const [utorid, email, password] = args;
    if(!utorid || !email || !password) {
        console.log("Usage: node prisma/createsu.js <utorid>, <email>, <password>");
        process.exit(1);
    }
    if(utorid.length < 7 || utorid.length > 8) {
        console.log("utorid must be between 7 and 8 characters long")
        process.exit(1);
    }

    const existing = await prisma.user.findFirst({
        where: {OR: [{utorid: utorid}, {email: email}]},
    })

    if(existing) {
        console.error("ERROR: A user with that utorid or email already exists")
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
        data: {
            utorid: utorid,
            email: email,
            password: hashedPassword,
            role: 'superuser',
            verified: true,
            activated: true,
        }
    });
}
main();