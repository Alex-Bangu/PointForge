'use strict'

const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const LOWER_ROLES = ["regular", "cashier"];
const UPPER_ROLES = ["manager", "superuser"];

const isValidISODate = (value) => {
    if(!value) {
        return false;
    }
    const timestamp = Date.parse(value);
    return !Number.isNaN(timestamp);
};

const normalizeType = (type) => {
    if(!type) {
        return null;
    }
    if(type === "one-time") {
        return "onetime";
    }
    return type;
};

router.post("/", auth, async (req, res) => {
    if (!UPPER_ROLES.includes(req.auth.role)) {
        return res.status(403).json({ "message": "Not authorized" });
    }
    let {name, description, type, startTime, endTime, minSpending, rate, points} = req.body;
    if (!name || !description || !type || !startTime || !endTime) {
        return res.status(400).json({"message": "Bad request"});
    }

    type = normalizeType(type);
    if(type !== "automatic" && type !== "onetime") {
        return res.status(400).json({"message": "Bad request"});
    }

    if (!isValidISODate(startTime) || !isValidISODate(endTime)) {
            return res.status(400).json({"message": "Bad request"});
    }

    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (startMs < Date.now()) {
        return res.status(400).json({ "message": "Bad request: Start time cannot be in the past." });
    }
    if (startMs >= endMs) {
        return res.status(400).json({ "message": "Bad request: Start time cannot be after end time." });
    }

    if (minSpending) {
        if (minSpending < 0 || isNaN(minSpending)) {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        minSpending = 0;
    }

    if (rate) {
        if (rate < 0 || isNaN(rate)) {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        rate = 0;
    }

    if (points) {
        if (points < 0 || isNaN(points)) {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        points = 0;
    }

    const promotion = await prisma.promotion.create({
        data: {
            name: name,
            description: description,
            type: type,
            startTime: startTime,
            endTime: endTime,
            minSpending: minSpending,
            rate: rate,
            points: points,
        }
    });
    return res.status(201).json({
        "id": promotion.id,
        "name": promotion.name,
        "description": promotion.description,
        "type": promotion.type,
        "startTime": promotion.startTime,
        "endTime": promotion.endTime,
        "minSpending": promotion.minSpending,
        "rate": rate,
        "points": points
    });
});

router.get("/", auth, async (req, res) => {
    const role = req.auth.role;
    if (!LOWER_ROLES.includes(role) && !UPPER_ROLES.includes(role)) {
        return res.status(403).json({"message": "Not authorized"});
    }

    let {
        name,
        type,
        page = 1,
        limit = 10,
        status,
        minSpendingMin,
        minSpendingMax,
        rateMin,
        rateMax,
        pointsMin,
        pointsMax,
        startAfter,
        startBefore,
        endAfter,
        endBefore,
        usableOnly,
        showUsableOnly
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    if(!page || page < 1 || !limit || limit < 1) {
               return res.status(400).json({"message": "Bad request"});
           }

    const where = {};
    if(name) {
        where.name = { contains: name };
    }
    if(type && type !== "all") {
        const normalizedType = normalizeType(type);
        if(normalizedType !== "automatic" && normalizedType !== "onetime") {
               return res.status(400).json({"message": "Bad request"});
           }
        where.type = normalizedType;
    }

    const attachRange = (key, minVal, maxVal, parser) => {
        const hasMin = minVal !== undefined && minVal !== "";
        const hasMax = maxVal !== undefined && maxVal !== "";
        const parsedMin = hasMin ? parser(minVal) : null;
        const parsedMax = hasMax ? parser(maxVal) : null;
        if((parsedMin !== null && Number.isNaN(parsedMin)) || (parsedMax !== null && Number.isNaN(parsedMax))) {
            throw new Error("Bad request");
        }
        if(parsedMin !== null || parsedMax !== null) {
            where[key] = {};
            if(parsedMin !== null) {
                where[key].gte = parsedMin;
            }
            if(parsedMax !== null) {
                where[key].lte = parsedMax;
            }
        }
    };

    const normalizeDateRange = (key, afterValue, beforeValue) => {
        let hasRange = false;
        if(afterValue) {
            if(!isValidISODate(afterValue)) {
                throw new Error("Bad request");
            }
            where[key] = where[key] || {};
            where[key].gte = new Date(afterValue);
            hasRange = true;
        }
        if(beforeValue) {
            if(!isValidISODate(beforeValue)) {
                throw new Error("Bad request");
            }
            where[key] = where[key] || {};
            where[key].lte = new Date(beforeValue);
            hasRange = true;
        }
        return hasRange;
    };

    try {
        attachRange("minSpending", minSpendingMin, minSpendingMax, (value) => parseInt(value));
        attachRange("rate", rateMin, rateMax, (value) => parseFloat(value));
        attachRange("points", pointsMin, pointsMax, (value) => parseInt(value));

        normalizeDateRange("startTime", startAfter, startBefore);
        normalizeDateRange("endTime", endAfter, endBefore);
    } catch (e) {
               return res.status(400).json({"message": "Bad request"});
    }

    const promotions = await prisma.promotion.findMany({
        where,
        include: {
            users: {
                select: {
                    id: true,
                    utorid: true,
                    name: true
                }
            }
        },
        orderBy: [
            { startTime: "asc" },
            { name: "asc" }
        ]
    });

    const now = Date.now();
    const defaultStatus = status || (LOWER_ROLES.includes(role) ? "active" : "all");
    let normalizedStatuses = defaultStatus
        .split(",")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);
    if(normalizedStatuses.length === 0) {
        normalizedStatuses = ["active"];
    }
    const includesAll = normalizedStatuses.includes("all");

    const shouldFilterUsable = (() => {
        if(usableOnly !== undefined) {
            return usableOnly === "true" || usableOnly === true;
        }
        if(showUsableOnly !== undefined) {
            return showUsableOnly === "true" || showUsableOnly === true;
        }
        return LOWER_ROLES.includes(role);
    })();

    let usedPromotionIds = new Set();
    if(LOWER_ROLES.includes(role)) {
        const user = await prisma.user.findUnique({
            where: { id: req.auth.id },
            select: { promotions: { select: { id: true } } }
        });
        if(user?.promotions) {
            usedPromotionIds = new Set(user.promotions.map(promo => promo.id));
        }
    }

    const annotatePromotion = (promotion) => {
        const startMs = Date.parse(promotion.startTime);
        const endMs = Date.parse(promotion.endTime);
        const isActive = startMs <= now && now < endMs;
        const isUpcoming = startMs > now;
        const hasEnded = now >= endMs;
        const isOneTime = promotion.type === "onetime";
        const alreadyUsed = isOneTime && usedPromotionIds.has(promotion.id);
        const usable = isActive && (!isOneTime || !alreadyUsed);
        let statusKey = "active";
        if(alreadyUsed) {
            statusKey = "in wallet";
        } else if(isUpcoming) {
            statusKey = "upcoming";
        } else if(hasEnded) {
            statusKey = "ended";
        }
        return {
            promotion,
            computed: {
                isActive,
                isUpcoming,
                hasEnded,
                statusKey,
                isOneTime,
                alreadyUsed,
                usable
            }
        };
    };

    const matchesStatus = (computed) => {
        if(includesAll) {
            return true;
        }
        return normalizedStatuses.includes(computed.statusKey);
    };

    const filteredPromotions = promotions
        .map(annotatePromotion)
        .filter(({ computed }) => matchesStatus(computed))
        .filter(({ computed }) => {
            if(!shouldFilterUsable) {
                return true;
            }
            // If filtering by "in wallet" status, always show in-wallet promotions regardless of usable state
            if(normalizedStatuses.includes("in wallet") && computed.statusKey === "in wallet") {
                return true;
            }
            // Allow in-wallet promotions through even if not usable (user wants to see what they've added)
            // Also allow automatic promotions (they're always usable if active)
            return computed.usable || !computed.isOneTime || computed.statusKey === "in wallet";
        });

    const total = filteredPromotions.length;
    const startIndex = (page - 1) * limit;
    const paged = filteredPromotions.slice(startIndex, startIndex + limit);

    const formatPromotion = ({ promotion, computed }) => {
        const base = {
            id: promotion.id,
            name: promotion.name,
            description: promotion.description,
            type: promotion.type,
            startTime: promotion.startTime ? new Date(promotion.startTime).toISOString() : null,
            endTime: promotion.endTime ? new Date(promotion.endTime).toISOString() : null,
            minSpending: promotion.minSpending,
            rate: promotion.rate,
            points: promotion.points,
            status: computed.statusKey,
            isActive: computed.isActive,
            isUpcoming: computed.isUpcoming,
            hasEnded: computed.hasEnded,
            isOneTime: computed.isOneTime,
            alreadyUsed: computed.alreadyUsed,
            usable: computed.usable
        };
        if(UPPER_ROLES.includes(role)) {
            base.userCount = promotion.users.length;
            base.recentUsers = promotion.users.slice(0, 5).map((user) => ({
                id: user.id,
                name: user.name,
                utorid: user.utorid
            }));
        }
        return base;
    };

       return res.status(200).json({
        count: total,
        page,
        limit,
        results: paged.map(formatPromotion)
    });
});

router.get("/:promotionId", auth, async (req, res) => {
    const promotionId = parseInt(req.params.promotionId);
    if(isNaN(promotionId)) {
        return res.status(400).json({"message": "Bad request"});
    }
    const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    utorid: true
                }
            }
        }
    });
    if(!promotion) {
        return res.status(404).json({"message": "Not Found"});
    }

    const now = Date.now();
    const startMs = Date.parse(promotion.startTime);
    const endMs = Date.parse(promotion.endTime);
    const isActive = startMs <= now && now < endMs;
    const isUpcoming = startMs > now;
    const hasEnded = now >= endMs;
    const isOneTime = promotion.type === "onetime";
    const alreadyUsed = isOneTime && promotion.users.some((user) => user.id === req.auth.id);
    const usable = isActive && (!isOneTime || !alreadyUsed);

    const response = {
        "id": promotion.id,
        "name": promotion.name,
        "description": promotion.description,
        "type": promotion.type,
        "startTime": promotion.startTime ? new Date(promotion.startTime).toISOString() : null,
        "endTime": promotion.endTime ? new Date(promotion.endTime).toISOString() : null,
        "minSpending": promotion.minSpending,
        "rate": promotion.rate,
        "points": promotion.points,
        "isActive": isActive,
        "isUpcoming": isUpcoming,
        "hasEnded": hasEnded,
        "isOneTime": isOneTime,
        "alreadyUsed": alreadyUsed,
        "usable": usable
    };

    if(UPPER_ROLES.includes(req.auth.role)) {
        response["userCount"] = promotion.users.length;
        response["recentUsers"] = promotion.users.slice(0, 10);
    }

    return res.status(200).json(response);
});

router.post("/:promotionId/use", auth, async (req, res) => {
    if(req.auth.role !== "regular") {
        return res.status(403).json({"message": "Only regular users can apply promotions directly"});
    }
    const promotionId = parseInt(req.params.promotionId);
    if(isNaN(promotionId)) {
        return res.status(400).json({"message": "Bad request"});
    }
    const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId },
        include: { users: { select: { id: true } } }
    });
    if(!promotion) {
        return res.status(404).json({"message": "Not Found"});
    }
    if(promotion.type !== "onetime") {
        return res.status(400).json({"message": "Promotion does not require usage tracking"});
    }
    const now = Date.now();
    const startMs = Date.parse(promotion.startTime);
    const endMs = Date.parse(promotion.endTime);
    if(startMs > now) {
        return res.status(409).json({"message": "Promotion has not started yet"});
    }
    if(endMs <= now) {
        return res.status(409).json({"message": "Promotion has ended"});
    }
    const alreadyUsed = promotion.users.some((user) => user.id === req.auth.id);
    if(alreadyUsed) {
        return res.status(409).json({"message": "Promotion already applied"});
    }
    await prisma.promotion.update({
        where: { id: promotionId },
        data: {
            users: {
                connect: { id: req.auth.id }
            }
        }
    });
    return res.status(201).json({"message": "Promotion applied"});
});

router.delete("/:promotionId/use", auth, async (req, res) => {
    if(!LOWER_ROLES.includes(req.auth.role)) {
        return res.status(403).json({"message": "Not Authorized"});
    }
    const promotionId = parseInt(req.params.promotionId);
    if(isNaN(promotionId)) {
        return res.status(400).json({"message": "Bad request"});
    }
    const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId },
        include: { users: { select: { id: true } } }
    });
    if(!promotion) {
        return res.status(404).json({"message": "Not Found"});
    }
    if(promotion.type !== "onetime") {
        return res.status(400).json({"message": "Promotion does not require usage tracking"});
    }
    const alreadyUsed = promotion.users.some((user) => user.id === req.auth.id);
    if(!alreadyUsed) {
        return res.status(409).json({"message": "Promotion not in wallet"});
    }
    await prisma.promotion.update({
        where: { id: promotionId },
        data: {
            users: {
                disconnect: { id: req.auth.id }
            }
        }
    });
    return res.status(200).json({"message": "Promotion removed from wallet"});
});

router.patch("/:promotionId", auth, async (req, res) => {
    if(!UPPER_ROLES.includes(req.auth.role)) {
        return res.status(403).json({"message": "Not Authorized"});
    }
    let promotionId = req.params.promotionId;
    promotionId = parseInt(promotionId);
    let promotion = await prisma.promotion.findUnique({
        where: {
            id: promotionId,
        }
    })
    if(!promotion) {
        return res.status(404).json({"message": "Not Found"});
    }
    let {name, description, type, startTime, endTime, minSpending, rate, points} = req.body;
    let updated = {}
    if(name || description || type || startTime || minSpending !== undefined || rate !== undefined || points !== undefined) {
        if(Date.parse(promotion.startTime) <= Date.now()) {
            return res.status(400).json({"message": "Cannot change, name, description, type, start time, minSpending, rate, or points after promotion has started."});
        }
    }
    if(startTime) {
        if(!isValidISODate(startTime)) {
            return res.status(400).json({"message": "Not a valid start time"});
        }
        if(Date.parse(startTime) < Date.now()) {
            return res.status(400).json({"message": "Start time cannot be in the past"});
        }
    }
    if(endTime) {
        if(!isValidISODate(endTime)) {
            return res.status(400).json({"message": "Not a valid end time"});
        }
        if(Date.parse(promotion.endTime) <= Date.now()) {
            return res.status(400).json({"message": "Promotion has already ended"});
        }
        if(Date.parse(endTime) < Date.now()) {
            return res.status(400).json({"message": "End time cannot be in the past"});
        }
    }
    if(name) {
        updated.name = name;
    }
    if(description) {
        updated.description = description;
    }
    if(type) {
        const normalizedType = normalizeType(type);
        if(normalizedType !== "automatic" && normalizedType !== "onetime") {
            return res.status(400).json({"message": "Invalid promotion type"});
        }
        updated.type = normalizedType;
    }
    if(startTime) {
        updated.startTime = startTime;
    }
    if(endTime) {
        updated.endTime = endTime;
    }
    if(minSpending !== undefined) {
        minSpending = parseInt(minSpending);
        if(isNaN(minSpending) || minSpending < 0) {
            return res.status(400).json({"message": "MinSpending must be a positive integer"});
        }
        updated.minSpending = minSpending;
    }
    if(rate !== undefined) {
        rate = parseFloat(rate);
        if(isNaN(rate) || rate < 0) {
            return res.status(400).json({"message": "Rate must be a positive number"});
        }
        updated.rate = rate;
    }
    if(points !== undefined) {
        points = parseInt(points);
        if(isNaN(points) || points < 0) {
            return res.status(400).json({"message": "Points must be a positive integer"});
        }
        updated.points = points;
    }
    promotion = await prisma.promotion.update({
        where: {id: promotionId},
        data: updated,
    });

    let toReturn = {
        "id": promotionId,
        "name": promotion.name,
        "type": promotion.type
    };
    if(startTime) {
        toReturn["startTime"] = startTime;
    }
    if(endTime) {
        toReturn["endTime"] = endTime;
    }
    if(minSpending) {
        toReturn["minSpending"] = minSpending;
    }
    if(rate) {
        toReturn["rate"] = rate;
    }
    if(points) {
        toReturn["points"] = points;
    }
    return res.status(200).json(toReturn);
});

router.delete("/:promotionId", auth, async (req, res) => {
    if(!UPPER_ROLES.includes(req.auth.role)) {
        return res.status(403).json({"message": "Not Authorized"});
    }

    let promotionId = req.params.promotionId;
    promotionId = parseInt(promotionId);
    const promotion = await prisma.promotion.findUnique({
        where: {
            id: promotionId,
        }
    });
    if(!promotion) {
        return res.status(404).json({"message": "Promotion not found"});
    }
    if(Date.parse(promotion.startTime) <= Date.now()) {
        return res.status(403).json({"message": "Promotion already started"});
    }
    await prisma.promotion.deleteMany({
        where: {
            id: promotionId,
        }
    });
    return res.status(204).json({"message": "Promotion deleted"});
})
module.exports = router;