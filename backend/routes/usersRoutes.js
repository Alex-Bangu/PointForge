'use strict'

const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const bcrypt = require("bcrypt");
const {v4: uuidv4} = require("uuid");
const router = express.Router();

const auth = require("../middleware/auth");

const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

// regex
const alphaNum = /^[a-z0-9]+$/i;
const emailRegex = /^[a-zA-Z0-9._%+-]+@mail\.utoronto\.ca$/i;
const dateRegex = /^(\d{4})-(02)-(29)|(\d{4})-(0[469]|11)-(30)|(\d{4})-(01|03|05|07|08|10|12)-(31)|(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|1\d|2[0-8])$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])(?!.*\s)[A-Za-z\d\W_]{8,128}$/;
const nameRegex = /^.{1,50}$/;

// Public registration endpoint (no auth required)
router.post("/", async (req, res) => {
    const {utorid, name, email, password} = req.body;
    if(!utorid || !name || !email || !password) {
        return res.status(400).json({"Message": "You must provide all inputs"});
    }

    let valid = alphaNum.test(utorid);
    if(!valid || utorid.length < 7 || utorid.length > 8) {
        return res.status(400).json({"Message": "UTORid must be alphanumeric and 7 - 8 characters long"});
    }

    if(name.length < 1 || name.length > 50) {
        return res.status(400).json({"Message": "Name must be less than 50 characters"});
    }

    valid = emailRegex.test(email);
    if(!valid) {
        return res.status(400).json({"Message": "Not a valid email"});
    }
    valid = passwordRegex.test(password);
    if(!valid) {
        return res.status(400).json({"Message": "Password must be alphanumeric and 8 - 128 characters long. Must include an uppercase letter and special character"});
    }

    const existing = await prisma.user.findUnique({
        where: {
            utorid: utorid
        }
    });

    if(existing) {
        return res.status(409).json({"Message": "Username not available"});
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
        data: {
            utorid: utorid,
            name: name,
            email: email,
            password: hashedPassword
        }
    });

    const uuid = uuidv4();
    const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();

    await prisma.resetToken.create({
        data: {
            token: uuid,
            uid: created.id,
            expiresAt: expiresAt,
        }
    })

    return res.status(201).json({"id": created.id,
                                "utorid": utorid,
                                "name": name,
                                "email": email,
                                "verified": false,
                                "expiresAt": expiresAt,
                                "resetToken": uuid,});
});

// Endpoint for cashiers+ to create accounts for users
router.post("/create", auth, async (req, res) => {
    // Check if user is cashier or higher
    if(req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden: Only cashiers and above can create accounts"});
    }

    const {utorid, name, email, password, role} = req.body;
    if(!utorid || !name || !email || !password) {
        return res.status(400).json({"Message": "You must provide utorid, name, email, and password"});
    }

    let valid = alphaNum.test(utorid);
    if(!valid || utorid.length < 7 || utorid.length > 8) {
        return res.status(400).json({"Message": "UTORid must be alphanumeric and 7 - 8 characters long"});
    }

    if(name.length < 1 || name.length > 50) {
        return res.status(400).json({"Message": "Name must be less than 50 characters"});
    }

    valid = emailRegex.test(email);
    if(!valid) {
        return res.status(400).json({"Message": "Not a valid email"});
    }
    valid = passwordRegex.test(password);
    if(!valid) {
        return res.status(400).json({"Message": "Password must be alphanumeric and 8 - 128 characters long. Must include an uppercase letter and special character"});
    }

    // Validate role if provided
    const validRoles = ['regular', 'cashier', 'manager', 'superuser'];
    let userRole = role || 'regular';
    if(!validRoles.includes(userRole)) {
        return res.status(400).json({"Message": "Invalid role"});
    }

    // Role restrictions: cashiers can only create regular users, managers can create regular/cashier, superusers can create any
    if(req.auth.role === "cashier" && userRole !== "regular") {
        return res.status(403).json({"Message": "Cashiers can only create regular user accounts"});
    }
    if(req.auth.role === "manager" && !['regular', 'cashier'].includes(userRole)) {
        return res.status(403).json({"Message": "Managers can only create regular and cashier accounts"});
    }

    const existing = await prisma.user.findUnique({
        where: {
            utorid: utorid
        }
    });

    if(existing) {
        return res.status(409).json({"Message": "Username not available"});
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
        data: {
            utorid: utorid,
            name: name,
            email: email,
            password: hashedPassword,
            role: userRole,
            activated: true  // Accounts created by staff are activated
        }
    });

    return res.status(201).json({
        "id": created.id,
        "utorid": created.utorid,
        "name": created.name,
        "email": created.email,
        "role": created.role,
        "verified": created.verified,
        "activated": created.activated
    });
});

router.get("/", auth, async (req, res) => {

    if(req.auth.role === "regular" || req.auth.role === "cashier") {
        return res.status(403).json({"Message": "Forbidden"});
    }

    let data = {};
    Object.keys(req.query).forEach((param) => {
        const value = req.query[param];
        if(param === "name" || param === "role") {
            data[param] = req.query[param];
        } else if(param === "verified" || param === "activated") {
            data[param] = (value === "true");
        }
    });

    let pageNumber = parseInt(req.query.page);
    let limit = parseInt(req.query.limit);
    if((!isNaN(pageNumber) && pageNumber < 1) || (!isNaN(limit) && limit < 1)) {
        return res.status(400).json({"Message": "Bad request"});
    }

    if(isNaN(pageNumber) || pageNumber < 1) {
        pageNumber = 1;
    }

    if(isNaN(limit) || limit < 1) {
        limit = 10;
    }


    const users = await prisma.user.findMany({
        skip: (pageNumber - 1) * limit,
        take: limit,
        where: data
    });

    const totalUsers = await prisma.user.findMany({
            where: data
        });

    const count = totalUsers.length;
    let returnArray = [];
    users.forEach((user) => {
        returnArray.push({
            id: user.id,
            utorid: user.utorid,
            name: user.name,
            email: user.email,
            birthday: user.birthday,
            role: user.role,
            points: user.points,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            verified: user.verified,
            suspicious: user.suspicious,
            avatarUrl: user.avatarUrl
        });
    });
    return res.status(200).json({"count": count, results: returnArray});
});

router.patch("/me", auth, async (req, res) => {
    let user = await prisma.user.findUnique({
        where: {
            id: req.auth.id
        }
    });
    if(!user) {
        return res.status(404).json({"Message": "How did you even get here?"});
    }

    const {name, email, birthday, avatar} = req.body;
    if(!name && !email && !birthday && !avatar) {
        return res.status(400).json({"Message": "Bad Request"});
    }
    if(name) {
        const valid = nameRegex.test(name);
        if(!valid) {
            return res.status(400).json({"Message": "Bad Request"});
        }
        await prisma.user.update({
            where: {id: req.auth.id},
            data: {name: name}
        });
    }
    if(email) {
        const valid = emailRegex.test(email);
        if(!valid) {
            return res.status(400).json({"Message": "Email is invalid"});
        }
        await prisma.user.update({
            where: {id: req.auth.id},
            data: {email: email}
        });
    }
    if(birthday) {
        const valid = dateRegex.test(birthday);
        if(!valid) {
            return res.status(400).json({"Message": "Birthday is invalid"});
        }
        await prisma.user.update({
            where: {id: req.auth.id},
            data: {birthday: birthday}
        });
    }
    if(avatar) {
        await prisma.user.update({
            where: {id: req.auth.id},
            data: {avatarURL: avatar}
        })
    }

    user = await prisma.user.findUnique({
        where: {
            id: req.auth.id
        }
    });

    return res.status(200).json({
        "id": user.id,
        "utorid": user.utorid,
        "name": user.name,
        "email": user.email,
        "birthday": birthday,
        "role": user.role,
        "points": user.points,
        "createdAt": user.createdAt,
        "lastLogin": user.lastLogin,
        "verified": user.verified,
        "avatarUrl": user.avatarURL,
    });
});

router.get("/me", auth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {id: req.auth.id},
        include: {promotions: true, attendedEvents: true, organizedEvents: true}
    }) ;
    if(!user) {
        return res.status(404).json({"Message": "How did you get here?"});
    }
    return res.status(200).json({
        "id": user.id,
        "utorid": user.utorid,
        "name": user.name,
        "email": user.email,
        "birthday": user.birthday,
        "role": user.role,
        "points": user.points,
        "createdAt": user.createdAt,
        "lastLogin": user.lastLogin,
        "verified": user.verified,
        "avatarUrl": user.avatarURL,
        "promotions": user.promotions,
        "attendedEvents": user.attendedEvents,
        "organizedEvents": user.organizedEvents
    })
});

// Endpoint for regular users to search users by UTORid (for transfers)
// MUST be before /search/:utorid route to avoid route conflicts
router.get("/search-transfer/:utorid", auth, async (req, res) => {
    if(req.auth.role !== "regular") {
        return res.status(403).json({"Message": "Forbidden: This endpoint is for regular users only"});
    }
    
    const utorid = req.params.utorid;
    if(!utorid) {
        return res.status(400).json({"Message": "Bad request"});
    }
    
    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid
        },
        select: {
            id: true,
            utorid: true,
            name: true,
            email: true,
            points: true
        }
    });

    if(!user) {
        return res.status(404).json({"Message": "User Not Found"});
    }

    // Can't transfer to yourself
    if(user.id === req.auth.id) {
        return res.status(400).json({"Message": "Cannot transfer to yourself"});
    }

    return res.status(200).json(user);
});

// Endpoint for cashiers/managers to search users by UTORid
// MUST be before /:userId route to avoid route conflicts
router.get("/search/:utorid", auth, async (req, res) => {
    if(req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden"});
    }
    
    const utorid = req.params.utorid;
    if(!utorid) {
        return res.status(400).json({"Message": "Bad request"});
    }
    
    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid
        },
        include: {
            promotions: true
        }
    });

    if(!user) {
        return res.status(404).json({"Message": "User Not Found"});
    }

    if(req.auth.role === "cashier") {
        return res.status(200).json({
            "id": user.id,
            "utorid": user.utorid,
            "name": user.name,
            "points": user.points,
            "verified": user.verified,
            "promotions": user.promotions
        });
    }

    return res.status(200).json({
        "id": user.id,
        "utorid": user.utorid,
        "name": user.name,
        "email": user.email,
        "birthday": user.birthday,
        "role": user.role,
        "points": user.points,
        "createdAt": user.createdAt,
        "lastLogin": user.lastLogin,
        "verified": user.verified,
        "avatarUrl": user.avatarURL,
        "promotions": user.promotions
    });
});

router.get("/:userId", auth, async (req, res) => {
    if(req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden"});
    }
    const user = await prisma.user.findUnique({
        where: {
            id: parseInt(req.params.userId)
        },
        include: {
            promotions: true
        }
    });

    if(!user) {
        return res.status(404).json({"Message": "User Not Found"});
    }

    if(req.auth.role === "cashier") {
        return res.status(200).json({
            "id": user.id,
            "utorid": user.utorid,
            "name": user.name,
            "points": user.points,
            "verified": user.verified,
            "promotions": user.promotions
        });
    }

    return res.status(200).json({
        "id": user.id,
        "utorid": user.utorid,
        "name": user.name,
        "email": user.email,
        "birthday": user.birthday,
        "role": user.role,
        "points": user.points,
        "createdAt": user.createdAt,
        "lastLogin": user.lastLogin,
        "verified": user.verified,
        "suspicious": user.suspicious,
        "activated": user.activated,
        "avatarUrl": user.avatarURL,
        "promotions": user.promotions
    });
});

router.patch("/:userId", auth, async (req, res) => {
    if(req.auth.role === "regular" || req.auth.role === "cashier") {
        return res.status(403).json({"Message": "Forbidden"});
    }

    const user = await prisma.user.findUnique({
        where: {
            id: parseInt(req.params.userId)
        }
    });

    if(!user) {
        return res.status(404).json({"Message": "User Not Found"});
    }

    var toReturn = {"id": user.id, "utorid": user.utorid, "name": user.name};

    const {email, verified, suspicious, role} = req.body;
    const hasEmail = email !== undefined && email !== null && email !== '';
    const hasVerified = verified !== undefined && verified !== null;
    const hasSuspicious = suspicious !== undefined && suspicious !== null;
    const hasRole = role !== undefined && role !== null && role !== '';
    
    if(!hasEmail && !hasVerified && !hasSuspicious && !hasRole) {
        return res.status(400).json({"Message": "Bad request"});
    }

    if(email) {
        const valid = emailRegex.test(email);
        if(!valid) {
            return res.status(400).json({"Message": "Bad Request"});
        }
        await prisma.user.update({
            where: {id: user.id},
            data: {email: email}
        });
        toReturn["email"] = email;
    }
    if(verified !== undefined && verified !== null) {
        // Only allow setting verified to true (one-time action)
        // Prevent unverifying users who are already verified
        if(user.verified && !verified) {
            return res.status(400).json({"Message": "Cannot unverify a user who is already verified"});
        }
        if(verified) {
            await prisma.user.update({
                where: {id: user.id},
                data: {verified: true},
            });
            toReturn["verified"] = true;
        }
    }
    if(suspicious !== undefined && suspicious !== null) {
        await prisma.user.update({
            where: {id: user.id},
            data: {suspicious: suspicious}
        });
        toReturn["suspicious"] = suspicious;
    }
    if(role) {
        if(req.auth.role === "manager") {
            if(role === "regular" || role === "cashier") {
                await prisma.user.update({
                    where: {id: user.id},
                    data: {role: role}
                });
                toReturn["role"] = role;
            } else if(role === "manager" || role === "superuser") {
                return res.status(403).json({"Message": "Forbidden"});
            } else {
                return res.status(400).json({"Message": "Bad Request"});
            }
        } else if(req.auth.role === "superuser") {
            if(role === "regular" || role === "cashier" || role === "manager" || role === "superuser") {
                await prisma.user.update({
                    where: {id: user.id},
                    data: {role: role}
                });
                toReturn["role"] = role;
            } else {
                return res.status(400).json({"Message": "Bad Request"});
            }
        } else {
            return res.status(403).json({"Message": "Forbidden"});
        }
    }
    return res.status(200).json(toReturn);
});

router.patch("/me/password", auth, async (req, res) => {
    const oldPass = req.body.old;
    const newPass = req.body.new;
    if(!oldPass || !newPass) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const user = await prisma.user.findUnique({
        where: {id: req.auth.id}
    });
    if(!user) {
        return res.status(404).json({"Message": "How did you get here?"});
    }
    if(!user.password) {
        return res.status(400).json({"Message": "Bad Request"});
    }
    const valid = await bcrypt.compare(oldPass, user.password);
    if(!valid) {
        return res.status(403).json({"Message": "Old Password is incorrect"});
    }
    const goodPassword = passwordRegex.test(newPass);
    if(!goodPassword) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const hashedPassword = await bcrypt.hash(newPass, 10);
    await prisma.user.update({
        where: {id: req.auth.id},
        data: {password: hashedPassword},
    });
    return res.status(200).json({"Message": "Password updated successfully"});
});

router.post('/me/transactions', auth, async (req, res) => {
    let {type, amount, remark} = req.body;
    if(!req.auth.verified) {
        return res.status(403).json({"Message": "Forbidden"});
    }
    if(!type || !amount) {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(type !== "redemption") {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(isNaN(amount) || amount <= 0) {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(remark === null || remark === undefined) {
        remark = "";
    }
    const user = await prisma.user.findUnique({
        where: {id: req.auth.id}
    });
    if(user.points < amount) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const redemption = await prisma.transaction.create({
        data: {
            type: type,
            amount: amount,
            spent: 0,
            remark: remark,
            createdBy: req.auth.utorid,
            issuer: {connect: {id: req.auth.id}},
            receiver: {connect: {id: req.auth.id}}
        }
    });
    await prisma.user.update({
        where: {id: req.auth.id},
        data: {receivedTransactions: {connect: {id: redemption.id}}}
    });
    return res.status(201).json({
        "id": redemption.id,
        "utorid": redemption.createdBy,
        "type": type,
        "processedBy": redemption.processedBy,
        "amount": amount,
        "remark": remark,
        "createdBy": redemption.createdBy
    });
});

router.get('/me/transactions', auth, async (req, res) => {
    let {type, relatedId, promotionId, amount, operator, page, limit} = req.query;
    let data = {};
    let filter = {};
    if(type) {
        data.type = type;
    }
    if(relatedId) {
        if(!type) {
            return res.status(400).json({"Message": "Bad request"});
        }
        relatedId = parseInt(relatedId);
        if(isNaN(relatedId)) {
            return res.status(400).json({"Message": "Bad request"});
        }
    }
    if(promotionId) {
        promotionId = parseInt(promotionId);
        if(isNaN(promotionId)) {
            return res.status(400).json({"Message": "Bad request"});
        }
        filter.promotionId = promotionId;
    }
    if(amount) {
        if(!operator) {
            return res.status(400).json({"Message": "Bad request"});
        }
        amount = parseFloat(amount);
        if(isNaN(amount)) {
            return res.status(400).json({"Message": "Bad request"});
        }
        filter.amount = amount;
    }
    if(operator) {
        if(operator !== "gte" && operator !== "lte") {
            return res.status(400).json({"Message": "Bad request"});
        }
        filter.operator = operator;
    }
    if(page) {
        page = parseInt(page);
        if(isNaN(page) || page < 1) {
            return res.status(400).json({"Message": "Bad request"});
        }
    } else {
        page = 1;
    }
    if(limit) {
        limit = parseInt(limit);
        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({"Message": "Bad request"});
        }
    }  else {
        limit = 10;
    }
    data.receiverId = req.auth.id;
    const transactions = await prisma.transaction.findMany({
        where: data,
        include: {
            promotions: true, receiver: true, issuer: true
        }
    });
    let filteredTransactions = [];
    for(let i = 0; i < transactions.length; i++) {
        if(promotionId) {
            if(transactions[i].promotions.some(p => p.id === promotionId)) {
                if(amount) {
                    if(transactions[i].amount <= amount && operator === "lte") {
                        filteredTransactions.push(transactions[i]);
                    } else if(transactions[i].amount >= amount && operator === "gte") {
                        filteredTransactions.push(transactions[i]);
                    }
                } else {
                    filteredTransactions.push(transactions[i]);
                }
            }
        } else {
            filteredTransactions.push(transactions[i]);
        }
    }
    const count = filteredTransactions.length;
    let toReturn = filteredTransactions.slice((page - 1) * limit, page * limit);
    toReturn.reverse();
    let toReturnJson = [];
    for(let i = 0; i < toReturn.length; i++) {
        let data = {};
        data["id"] = toReturn[i].id;
        data["utorid"] = toReturn[i].receiver.utorid;
        data["type"] = toReturn[i].type;
        data["remark"] = toReturn[i].remark;
        data["createdBy"] = toReturn[i].createdBy;
        data["date"] = toReturn[i].date ? new Date(toReturn[i].date).toISOString() : null;
        let promotionIds = []
        for(let j = 0; j < toReturn[i].promotions.length; j++) {
            promotionIds.push(toReturn[i].promotions[j].id);
        }
        if(toReturn[i].type !== "event" && toReturn[i].type !== "transfer") {
            data["amount"] = toReturn[i].amount;
        }
        data["promotionIds"] = promotionIds;
        if(toReturn[i].type === "purchase") {
            // Ensure spent is returned as a float, not rounded
            data["spent"] = parseFloat(toReturn[i].spent) || 0;
            data["suspicious"] = toReturn[i].suspicious;
        }
        if(toReturn[i].type === "redemption") {
            data["relatedId"] = toReturn[i].relatedId;
            data["redeemed"] = toReturn[i].amount * -1;
        }
        if(toReturn[i].type === "adjustment") {
            data["relatedId"] = toReturn[i].relatedId;
            data["suspicious"] = toReturn[i].suspicious;
        }
        if(toReturn[i].type === "event") {
            data["recipient"] = toReturn[i].receiver.utorid;
            data["awarded"] = toReturn[i].amount;
            data["relatedId"] = toReturn[i].relatedId;
        }
        if(toReturn[i].type === "transfer") {
            data["sender"] = toReturn[i].issuer.utorid;
            data["recipient"] = toReturn[i].receiver.utorid;
            data["sent"] = toReturn[i].amount;
        }
        toReturnJson.push(data);
    }
    return res.status(200).json({"count": count, "results": toReturnJson});
});

// Return all active promotions held by the logged in user
router.get("/me/promotions", auth, async (req, res) => {
    if(req.auth.role === "regular") {
        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            include: {
                promotions: true
            }
        });

        if(!user) {
            return res.status(401).json({"Message": "User not found"});
        }
        let activePromotions = [];
        const now = new Date();
        for(let i = 0; i < user.promotions.length; i++) {
            let promotion = user.promotions[i];
            if (!promotion || !promotion.startTime || !promotion.endTime) {
                continue;
            }
            const startTime = new Date(promotion.startTime);
            const endTime = new Date(promotion.endTime);
            if(startTime <= now && now <= endTime) {
                activePromotions.push(promotion);
            }
        }
        return res.status(200).json({"promotions": activePromotions});
    }
});

router.post('/me/:promotionId', auth, async (req, res) => {
    const user = await prisma.user.findUnique({
        where: {id: req.auth.id},
        include: {
            promotions: true
        }
    });
    if(!user) {
        return res.status(404).json({"Message": "User Not Found"});
    }
    const promotionId = parseInt(req.params.promotionId);
    if(isNaN(promotionId)) {
        return res.status(401).json({"Message": "Bad Request"});
    }

    const promotion = await prisma.promotion.findUnique({
        where: {
            id: promotionId,
        }
    });

    if(!promotion) {
        return res.status(404).json({"Message": "Promotion not found"});
    }

    const exists = user.promotions.some(promotion => promotion.id === promotionId);
    if(exists) {
        return res.status(401).json({"Message": "You already have this promotion"});
    }

    await prisma.user.update({
        where: {
            id: req.auth.id
        },
        data: {
            promotions: {
                connect: {
                    id: promotionId
                }
            }
        }
    });
    await prisna.promotion.update({
        where: {
            id: promotionId,
        },
        data: {
            users: {
                connect: {
                    id: req.auth.id
                }
            }
        }
    });

    return res.status(200).json({"message": "Promotion added successfully to your account"});
});

router.post('/:userId/transactions', auth, async (req, res) => {
    const userId = parseInt(req.params.userId);
    if(isNaN(userId)) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const receiver = await prisma.user.findUnique({
        where: {id: userId}
    });
    if(!receiver) {
        return res.status(404).json({"Message": "User Not Found"});
    }
    if(userId === req.auth.id) {
        return res.status(400).json({"Message": "Bad request"});
    }
    let {type, amount, remark} = req.body;
    if(!type || type !== "transfer") {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(!amount || isNaN(amount) || amount < 0) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const sender = await prisma.user.findUnique({
        where: {id: req.auth.id },
    });
    if(remark === null || remark === undefined) {
        remark = ""
    }
    if(sender.points < amount) {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(!sender.verified) {
        return res.status(403).json({"Message": "Forbidden"});
    }
    const transaction1 = await prisma.transaction.create({
        data: {
            type: type,
            spent: 0,
            amount: amount,
            remark: remark,
            issuer: {connect: {id: req.auth.id }},
            receiver: {connect: {id: receiver.id}},
            createdBy: req.auth.utorid
        }
    });
    const transaction2 = await prisma.transaction.create({
        data: {
            type: type,
            spent: 0,
            amount: amount,
            remark: remark,
            issuer: {connect: {id: req.auth.id }},
            receiver: {connect: {id: receiver.id}},
            createdBy: req.auth.utorid
        }
    });

    const update1 = await prisma.user.update({
        where: {id: req.auth.id},
        data: {
            issuedTransactions: {connect: {id: transaction1.id}},
            points: {decrement: amount}
        }
    });
    const update2 = await prisma.user.update({
        where: {id: userId},
        data: {
            receivedTransactions: {connect: {id: transaction2.id}},
            points: {increment: amount}
        }
    });

    if(!update1 || !update2) {
        return res.status(500).json({"Message": "Something went wrong"});
    }

    if(!transaction1 || !transaction2) {
        return res.status(500).json({"Message": "Something went wrong"});
    }

    return res.status(201).json({
        "id": transaction1.id,
        "sender": sender.utorid,
        "recipient": receiver.utorid,
        "type": type,
        "sent": amount,
        "remark": remark,
        "createdBy": req.auth.utorid
    });
});

module.exports = router;