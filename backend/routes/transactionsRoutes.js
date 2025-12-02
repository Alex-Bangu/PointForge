'use strict'

const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check if a promotion is currently active
const isPromotionActive = (promotion) => {
    const now = Date.now();
    const startTime = Date.parse(promotion.startTime);
    const endTime = Date.parse(promotion.endTime);
    return startTime <= now && now < endTime;
};

// Helper function to validate a promotion for a transaction
const validatePromotion = async (promotionId, user, spent) => {
    const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId }
    });
    
    if (!promotion) {
        return { valid: false, error: "Promotion not found." };
    }
    
    if (!isPromotionActive(promotion)) {
        return { valid: false, error: "Promotion is not active." };
    }
    
    if (promotion.type === "automatic") {
        // Just check minimum spending requirement
        if (promotion.minSpending !== null && promotion.minSpending > spent) {
            return { valid: false, error: "Minimum spending requirement not met." };
        }
    } else if (promotion.type === "onetime") {
        // One-time promotions must be in user's wallet
        const userHasPromotion = user.promotions.some(p => p.id === promotion.id && p.type === "onetime");
        if (!userHasPromotion) {
            return { valid: false, error: "Promotion not in user's wallet." };
        }
        // Check minimum spending requirement
        if (promotion.minSpending !== null && promotion.minSpending > spent) {
            return { valid: false, error: "Minimum spending requirement not met." };
        }
    } else {
        return { valid: false, error: "Invalid promotion type." };
    }
    
    return { valid: true, promotion };
};

// Helper function to calculate promotion points
const calculatePromotionPoints = (promotion, spent) => {
    if (promotion.minSpending !== null && promotion.minSpending > spent) {
        return 0;
    }
    return (promotion.points || 0) + Math.ceil((promotion.rate || 0) * spent * 100);
};

router.post('/', auth, async (req, res) => {
    const transactionTypes = ["purchase", "adjustment"];
    if(req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden"});
    }
    let {utorid, type, spent, promotionIds, remark, relatedId, amount} = req.body;
    if(!utorid || !type || (!spent && !amount)) {
        return res.status(400).json({"Message": "Bad request"});
    }
    
    if(spent !== undefined && spent !== null) {
        spent = parseFloat(String(spent));
        if(isNaN(spent) || spent < 0) {
            return res.status(400).json({"Message": "Bad request"});
        }
    }
    if(promotionIds === null) {
        promotionIds = [];
    }
    if(relatedId) {
        if(req.auth.role === "cashier") {
            return res.status(403).json({"Message": "Forbidden"});
        } else if(type !== "adjustment") {
            return res.status(400).json({"Message": "Bad request"});
        }
        if(!amount) {
            return res.status(400).json({"Message": "Bad request"});
        }
        const related = await prisma.transaction.findUnique({
            where: {
                id: relatedId
            }
        });
        if(!related) {
            return res.status(404).json({"Message": "Transaction Not Found"});
        }
    }
    const user = await prisma.user.findUnique({
        where: {utorid: utorid},
        include: {
            promotions: true
        }
    });
    if (!user) {
        return res.status(404).json({"Message": "User not found"});
    }
    if(!transactionTypes.includes(type)) {
        return res.status(400).json({"Message": "Bad request"});
    }
    // Validate all promotions
    if(promotionIds && promotionIds.length > 0) {
        for(let i = 0; i < promotionIds.length; i++) {
            if(isNaN(promotionIds[i])) {
                return res.status(400).json({"Message": "Bad request"});
            }
            
            const validation = await validatePromotion(promotionIds[i], user, spent);
            if(!validation.valid) {
                    return res.status(400).json({"Message": "Bad request"});
            }
        }
    }

    // Calculate points: base points + promotion points
    const basePoints = Math.ceil(spent * 4);
    let promotionPoints = 0;
    
    // Fetch all promotions at once to reduce database queries
    if(promotionIds && promotionIds.length > 0) {
        const promotions = await prisma.promotion.findMany({
            where: { id: { in: promotionIds } }
        });
        
        promotions.forEach(promotion => {
            promotionPoints += calculatePromotionPoints(promotion, spent);
        });
    }
    
    const earned = basePoints + promotionPoints;

    const suspicious = req.auth.suspicious;
    let data = {};
    if(type === "purchase") {
        data.amount = earned;
    } else {
        data.amount = amount;
    }
    if(data.amount !== 0 && !(req.auth.role === "cashier" && suspicious)) {
        await prisma.user.update({
            where: {
                utorid: utorid,
            },
            data: {
                points: {
                    increment: data.amount
                }
            }
        });
    }
    data.type = type;
    if(type === "adjustment") {
        data.spent = 0;
        data.relatedId = relatedId;
    } else {
        data.spent = spent;
    }
    
    if(remark) {
        data.remark = remark;
    }
    data.suspicious = suspicious;
    data.issuerId = req.auth.id;
    data.receiverId = user.id;
    data.createdBy = req.auth.utorid;
    
    // Ensure spent is explicitly a number with decimals preserved
    if (type !== "adjustment" && data.spent) {
        // Convert to string first, then back to float to preserve precision
        const spentStr = String(data.spent);
        data.spent = parseFloat(spentStr);
    }
    
    // Create transaction with promotions connected
    const transaction = await prisma.transaction.create({
                data: {
            ...data,
            promotions: promotionIds && promotionIds.length > 0 ? {
                connect: promotionIds.map(id => ({ id }))
            } : undefined
        }
    });
    
    // Remove one-time promotions from user's wallet after transaction creation
    if(promotionIds && promotionIds.length > 0) {
        // Fetch all promotions to identify one-time promotions
        const promotions = await prisma.promotion.findMany({
            where: { id: { in: promotionIds } }
            });
        
        // Filter one-time promotions and remove them from user's wallet
        const oneTimePromotionIds = promotions
            .filter(p => p.type === "onetime")
            .map(p => p.id);
        
        if(oneTimePromotionIds.length > 0) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    promotions: {
                        disconnect: oneTimePromotionIds.map(id => ({ id }))
                    }
                }
            });
        }
    }
    await prisma.transaction.update({
        where: {
            id: transaction.id
        },
        data: {
            receiver: {
                connect: {id: user.id}
            },
            issuer: {
                connect: {id: req.auth.id}
            }
        }
    });
    await prisma.user.update({
        where: {
            id: user.id
        },
        data: {
            receivedTransactions: {connect: {id: transaction.id}}
        }
    });
    await prisma.user.update({
        where: {
            id: req.auth.id
        },
        data: {
            issuedTransactions: {connect: {id: transaction.id}}
        }
    });
    if(suspicious) {
        data.amount = 0;
    }
    if(type === "adjustment") {
        return res.status(201).json({
            "id": transaction.id,
            "utorid": utorid,
            "type": data.type,
            "amount": data.amount,
            "remark": data.remark,
            "promotionIds": promotionIds,
            "createdBy": req.auth.utorid,
            "relatedId": data.relatedId,
        });
    }
    return res.status(201).json({
        "id": transaction.id,
        "utorid": utorid,
        "type": data.type,
        "spent": parseFloat(transaction.spent) || 0, // Ensure float is returned
        "earned": data.amount,
        "remark": data.remark,
        "promotionIds": promotionIds,
        "createdBy": req.auth.utorid
    });
});
router.get('/', auth, async (req, res) => {
    const higherRoles = ["manager", "superuser"];
    const validTypes = ["purchase", "adjustment", "transfer", "event", "redemption"];
    if(!higherRoles.includes(req.auth.role)) {
        return res.status(403).json({"message": "Forbidden"});
    }
    let {name, createdBy, suspicious, promotionId, type, relatedId, amount, operator, page, limit} = req.query;
    // type checking
    let data = {};
    let filter = {};
    if(name) {
        data.receiver.utorid = name;
        const utoridCheck = await prisma.user.findUnique({
            where: {
                utorid: name
            }
        });
        const nameCheck = await prisma.user.findFirst({
            where: {
                name: name
            }
        });
        if(utoridCheck) {
            data.receiver.utorid = name;
        } else if (nameCheck) {
            data.receiver.utorid = nameCheck.utorid;
        }
    }
    if(createdBy) {
        data.createdBy = createdBy;
    }
    if(suspicious) {
        data.suspicious = (suspicious === "true");
    }
    if(promotionId) {
        promotionId = parseInt(promotionId);
        if(isNaN(promotionId)) {
            return res.status(400).json({"message": "Bad request"});
        }
        filter.promotionId = promotionId;
    }
    if(type) {
        if(!validTypes.includes(type)) {
            return res.status(400).json({"message": "Invalid type"});
        }
        data.type = type;
    }
    if(relatedId) {
        if(!type) {
            return res.status(400).json({"message": "Bad request"});
        }
        if(type === "purchase") {
            return res.status(400).json({"message": "Bad request"});
        }
        data.relatedId = parseInt(relatedId);
    }
    if(amount) {
        if(!operator) {
            return res.status(400).json({"message": "Bad request"});
        }
        amount = parseFloat(amount);
        if(isNaN(amount)) {
            return res.status(400).json({"message": "Bad request"});
        }
        filter.amount = amount;
    }
    if(operator) {
        if(operator !== "gte" && operator !== "lte") {
            return res.status(400).json({"message": "Bad request"});
        }
        filter.operator = operator;
    }
    if(page) {
        page = parseInt(page);
        if(isNaN(page) || page < 1) {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        page = 1
    }
    if(limit) {
        limit = parseInt(limit);
        if(isNaN(limit) || limit < 1) {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        limit = 10;
    }
    const transactions = await prisma.transaction.findMany({
        where: data,
        include: {
            promotions: true, receiver: true, issuer: true
        }
    });
    let filtered = [];
    for(let i = 0; i < transactions.length; i++) {
        if(promotionId) {
            if(transactions[i].promotions.some(p => p.id === promotionId)) {
                if(amount) {
                    if(operator === "gte") {
                        if(transactions[i].amount >= amount) {
                            filtered.push(transactions[i]);
                        }
                    } else if(operator === "lte") {
                        if(transactions[i].amount <= amount) {
                            filtered.push(transactions[i]);
                        }
                    }
                } else {
                    filtered.push(transactions[i]);
                }
            }
        } else if(amount) {
            if(operator === "gte") {
                if(transactions[i].amount >= amount) {
                    filtered.push(transactions[i]);
                }
            } else if(operator === "lte") {
                if(transactions[i].amount <= amount) {
                    filtered.push(transactions[i]);
                }
            }
        } else {
            filtered.push(transactions[i]);
        }
    }
    const count = filtered.length;
    let toReturn = filtered.slice((page - 1) * limit, page * limit);
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

router.patch('/:transactionId/suspicious', auth, async (req, res) => {
    if(req.auth.role === "cashier" || req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden"});
    }
    const {suspicious} = req.body;
    if(suspicious === null) {
        return res.status(400).json({"Message": "Bad request"});
    }
    if(suspicious !== true && suspicious !== false) {
        return res.status(400).json({"Message": "Bad request"});
    }
    const transactionId = parseInt(req.params.transactionId);
    const transaction = await prisma.transaction.findUnique({
        where: {
            id: transactionId,
        }
    });
    if(!transaction) {
        return res.status(404).json({"Message": "Transaction not found"});
    }
    if(transaction.suspicious === suspicious) {
        return res.status(400).json({"Message": "Already suspicious / not suspicious"});
    }
    const updated = await prisma.transaction.update({
        where: {
            id: transactionId,
        },
        data: {
            suspicious: suspicious
        },
        include: {
            promotions: true
        }
    });
    const receiverId = updated.receiverId;
    const issuerId = updated.issuerId;
    let toAdd = 0;
    if(suspicious) {
        toAdd = updated.amount * -1
    } else {
        toAdd = updated.amount;
    }
    const user = await prisma.user.update({
        where: {
            id: receiverId
        },
        data: {
            points: {
                increment: toAdd
            }
        }
    });
    const creator = await prisma.user.findUnique({
        where: {
            id: issuerId
        }
    });
    let promotionids = [];
    for(let i = 0; i < updated.promotions.length; i++) {
        promotionids.push(updated.promotions[i].id);
    }
    return res.status(200).json({
        "id": transactionId,
        "utorid": user.utorid,
        "type": updated.type,
        "spent": updated.spent,
        "amount": updated.amount,
        "promotionIds": promotionids,
        "suspicious": updated.suspicious,
        "remark": updated.remark,
        "createdBy": creator.utorid
    });
});

router.patch('/:transactionId/processed', auth, async (req, res) => {
    if(req.auth.role === "regular") {
        return res.status(403).json({"Message": "Forbidden"});
    }
   const transactionId = parseInt(req.params.transactionId);
   if(isNaN(transactionId)) {
       return res.status(400).json({"Message": "Bad request"});
   }
   const { processed } = req.body;
   if(!processed || processed !== true) {
       return res.status(400).json({"Message": "Bad request"});
   }
   let transaction = await prisma.transaction.findUnique({
       where: {
           id: transactionId,
       }
   });
   if(!transaction) {
       return res.status(404).json({"Message": "Transaction not found"});
   }
   if(transaction.processed !== null && transaction.processed === true) {
       return res.status(400).json({"Message": "Bad request"});
   }
   if(transaction.type !== "redemption") {
       return res.status(400).json({"Message": "Bad request"});
   }
   transaction = await prisma.transaction.update({
       where: {
           id: transactionId,
       },
       data: {
           processedBy: req.auth.utorid,
           processed: true
       }
   });
   await prisma.user.update({
       where: {
           id: transaction.receiverId
       },
       data: {
           points: {
               decrement: transaction.amount
           }
       }
   });
   return res.status(200).json({
       "id": transactionId,
       "utorid": transaction.createdBy,
       "type": "redemption",
       "processedBy": req.auth.utorid,
       "redeemed": transaction.amount,
       "remark": transaction.remark,
       "createdBy": transaction.createdBy
   });
});

router.get("/:transactionId", auth, async (req, res) => {
    const higherRoles = ["manager", "superuser"];
    if(!higherRoles.includes(req.auth.role)) {
        return res.status(403).json({"Message": "Forbidden"});
    }
    const transactionId = parseInt(req.params.transactionId);
    const transaction = await prisma.transaction.findUnique({
        where: {
            id: transactionId
        },
        include: {
            promotions: true,
            issuer: true
        }
    });
    if(!transaction) {
        return res.status(404).json({"Message": "Transaction not found"});
    }
    const receiver = await prisma.user.findUnique({
        where: {
            id: transaction.receiverId
        }
    });
    let promotionIds = [];
    for(let i = 0; i < transaction.promotions.length; i++) {
        promotionIds.push(transaction.promotions[i].id);
    }
    return res.status(200).json({
        "id": transactionId,
        "utorid": receiver.utorid,
        "type": transaction.type,
        "spent": transaction.spent,
        "amount": transaction.amount,
        "promotionIds": promotionIds,
        "suspicious": transaction.suspicious,
        "remark": transaction.remark,
        "createdBy": transaction.issuer.utorid,
        "relatedId": transaction.relatedId
    });
});



module.exports = router;