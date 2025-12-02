'use strict'

const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const bcrypt = require("bcrypt");
const {v4: uuidv4} = require("uuid");
const jsonwebtoken = require("jsonwebtoken");
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY
});
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// regex
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])(?!.*\s)[A-Za-z\d\W_]{8,20}$/;

// request limiter
const limitMap = new Map();

function limit60s(req, res) {
    const ip = req.ip;
    const now = Date.now();
    const lastRequest = limitMap.get(ip);
    limitMap.set(ip, now);

    if(lastRequest && now - lastRequest < 60 * 1000) {
        return 1
    } else {
        return 0;
    }
}

async function sendReset(email, htmlContent) {
    const mailData = {
        from: `PointForge <mailgun@${process.env.MAILGUN_DOMAIN}>`,
        to: email,
        subject: "Your PointForge Password Reset",
        html: htmlContent, // Use HTML for rich formatting
    };

    try {
        const response = await mg.messages.create(process.env.MAILGUN_DOMAIN, mailData);
        console.log("Email sent successfully:", response);
        return response;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}

function generateResetHTML(resetLink) {
    return `
        <!DOCTYPE html>
        <html lang="en">
            <body>
                <div class="container">
                    <h2>Password Reset Request</h2>
                    <p>We received a request to reset your password. Click the link below to continue:</p>
                    <a href='${resetLink}'>Click here to reset your password</a>
                    <p style="margin-top: 30px; font-size: 0.9em; color: #666;">If you did not request a password reset, please ignore this email.</p>
                </div>
            </body>
        </html>
    `
}

router.post("/tokens", async (req, res) => {
    const {utorid, password} = req.body;
    if(!utorid || !password) {
        return res.status(400).json({"Error": "Missing utorid or password"});
    }

    const user = await prisma.user.findUnique(
        { where: {utorid} }
    );
    console.log(user);

    if (!user) {
        return res.status(400).json({"Error": "User not found"});
    }

    if(!user.password) {
        return res.status(401).json({"Error": "User has no set password"});
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
        return res.status(401).json({"Error": "Invalid password"});
    }
    await prisma.user.update({
        where: {utorid: utorid},
        data: {
            lastLogin: new Date(Date.now()).toISOString(),
            activated: true
        }
    });

    const token = jsonwebtoken.sign(
        {
            id: user.id,
            utorid: user.utorid,
            role: user.role,
            suspicious: user.suspicious,
            verified: user.verified,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30m" },
    );

    const expiresAt = new Date(Date.now() + (30 * 60 * 1000)).toISOString();
    return res.status(200).json({token, expiresAt});
});

router.post("/resets", async (req, res) => {
    const { utorid, email } = req.body;
    if(!utorid) {
        return res.status(400).json({"message": "Missing utorid"});
    }

    if(!email) {
        return res.status(400).json({"message": "Missing email"});
    }

    const user = await prisma.user.findUnique(
        { where: {utorid} }
    );

    if (!user) {
        return res.status(404).json({"message": "User not found"});
    }
    /*
    if(user.email !== email) {
        return res.status(401).json({"message": "Email does not match utorid"});
    }
     */

    const tooManyRequests = limit60s(req, res);
    if(tooManyRequests == 1) {
        return res.status(429).json({"message": "Too many reset requests in 60s, please wait 60 seconds"})
    }

    const uuid = uuidv4();
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)).toISOString();

    const existingToken = await prisma.resetToken.findUnique({
        where: {
            uid: user.id,
        }
    });

    if(existingToken) {
        await prisma.resetToken.delete({
            where: {
                uid: user.id
            }
        });
    }

    await prisma.ResetToken.create({
        data: {
            token: uuid,
            uid: user.id,
            expiresAt: expiresAt
        }
    });

    const resetLink = "https://pointforge-production-c592.up.railway.app" + uuid;
    const htmlContent = generateResetHTML(resetLink);
    await sendReset(email, htmlContent);

    return res.status(202).json({"expiresAt": expiresAt});
})

router.post("/resets/:resetToken", async (req, res) => {
    const {password} = req.body;

    if(!password) {
        return res.status(400).json({"message": "Missing password"});
    }

    const toFind = req.params.resetToken;
    console.log("token uuid: ", toFind);
    const token = await prisma.resetToken.findUnique({
        where: {
            token: toFind,
        }
    });

    if(!token) {
        return res.status(404).json({"message": "Token not found"});
    }

    const user = await prisma.user.findUnique({
        where: {
            id: token.uid,
        }
    });

    if(!user) {
        return res.status(400).json({"message": "User not found"});
    }

    if(new Date(token.expiresAt) - Date.now() < 0) {
        await prisma.resetToken.delete({
            where: {
                token: toFind
            }
        });
        return res.status(410).json({"message": "Token expired"});
    }

    if(token.uid !== user.id) {
        return res.status(401).json({"message": "Invalid token"});
    }
    const validPassword = passwordRegex.test(password);
    if(!validPassword) {
        return res.status(400).json({"message": "Password must be alphanumeric and 8 - 128 characters long. Must also include an uppercase letter and special character"});
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: {id: token.uid},
        data: {
            password: hashedPassword
        }
    });

    await prisma.resetToken.delete({
        where: {
            token: toFind
        }
    });

    return res.status(200).json({"message": "Password updated successfully"});
})

module.exports = router;