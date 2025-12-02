'use strict'

const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

// regex
const isValidISODate = (value) => {
    if(!value) {
        return false;
    }
    const timestamp = Date.parse(value);
    return !Number.isNaN(timestamp);
};
router.route("/")
    .post(auth, async (req, res) => {
        const authorized = ["manager", "superuser"];
        if(!authorized.includes(req.auth.role)) {
            return res.status(403).json({"message": "Not authorized"});
        }
        let {name, description, location, startTime, endTime, capacity, points, placeId} = req.body;
        if(!name || !description || !location || !startTime || !endTime || !points) {
            return res.status(400).json({"message": "Bad request"});
        }
        const validStart = isValidISODate(startTime);
        const validEnd = isValidISODate(endTime);
        if(!validStart || !validEnd) {
            return res.status(400).json({"message": "Bad request"});
        }
        if(Date.parse(startTime) >= Date.parse(endTime)) {
            return res.status(400).json({"message": "Bad request"});
        }
        points = parseInt(points);
        if(points < 0) {
            return res.status(400).json({"message": "Bad request"});
        }
        if(capacity) {
            capacity = parseInt(capacity);
            if(capacity < 0) {
                return res.status(400).json({"message": "Bad request"});
            }
        } else {
            capacity = null;
        }

        let data = {};
        data.name = name;
        data.description = description;
        data.location = location;
        data.startTime = startTime;
        data.endTime = endTime;
        data.pointsRemain = points;
        data.placeId = placeId;
        if(capacity) {
            data.capacity = capacity;
        }

        const event = await prisma.event.create({
            data,
            include: {
                organizers: true,
                guests: true,
            }
        });
        let toReturn = {};
        toReturn["id"] = event.id;
        toReturn["name"] = name;
        toReturn["description"] = description;
        toReturn["location"] = location;
        toReturn["startTime"] = startTime;
        toReturn["endTime"] = endTime;
        toReturn["capacity"] = event.capacity;
        toReturn["pointsRemain"] = event.pointsRemain;
        toReturn["pointsAwarded"] = event.pointsAwarded;
        toReturn["published"] = event.published;
        toReturn["organizers"] = event.organizers;
        toReturn["guests"] = event.guests;
        toReturn["placeId"] = event.placeId;
        return res.status(201).json(toReturn);
    })
    .get(auth, async (req, res) => {
        const higherRoles = ["manager", "superuser"];
        let {name, location, started, ended, showFull, page, limit} = req.query;
        let published = true;
        if(higherRoles.includes(req.auth.role)) {
            if(req.query.published) {
                published = req.query.published;
            } else {
                published = null;
            }
            if((published === "true" || published === "false") && published !== null) {
                published = (published === "true");
            } else if(published !== null) {
                return res.status(400).json({"message": "Bad request"});
            }
        }
        let data = {};
        if(published !== null) {
            data.published = published;
        }
        if(name) {
            data.name = {
                startsWith: name
            };
        }
        if(location) {
            data.location = {
                startsWith: location
            }
        }
        if(started) {
            if (started === "true" || started === "false") {
                started = (started === "true");
            } else {
                return res.status(400).json({"message": "Bad request"});
            }
        }
        if(ended) {
            if(ended === "true" || ended === "false") {
                ended = (ended === "true");
            } else {
                return res.status(400).json({"message": "Bad request"});
            }
        }
        if(showFull) {
            if(showFull === "true" || showFull === "false") {
                showFull = (showFull === "true");
                console.log("showFull", showFull);
            } else {
                return res.status(400).json({"message": "Bad request"});
            }
        } else {
            showFull = false;
        }
        if(showFull === false) {
            data.full = showFull;
        }
        if(page !== null && page !== undefined) {
            page = parseInt(page);
            if(isNaN(page) || page < 1) {
                return res.status(400).json({"message": "Bad request"});
            }
        } else {
            page = 1
        }
        if(limit !== null && limit !== undefined) {
            limit = parseInt(limit);
            if(isNaN(limit) || limit < 1) {
                return res.status(400).json({"message": "Bad request"});
            }
        } else {
            limit = 10
        }

        let promotions = await prisma.event.findMany({  // terrible variable name, i was probably really tired when writing this endpoint
            where: data,
            include: {
                guests: true,
                organizers: true
            }
        });
        console.log("unfiltered events length: ", promotions.length);
        // for debugging purposes:
        console.log("BEFORE FILTER ===========================================================================");
        let filteredPromotions = [];
        for(let i = 0; i < promotions.length; i++) {
            console.log(promotions[i]);
            let promotion = promotions[i];
            let promotionStart = Date.parse(promotion.startTime);
            let promotionEnd = Date.parse(promotion.endTime);
            let now = Date.now();
            const hasStarted = started ?? undefined;
            const hasEnded = ended ?? undefined;

            if(hasStarted === false && hasEnded === true) {
                return res.status(400).json({"message": "Bad request"});
            }

            if(hasStarted !== undefined && hasEnded !== undefined) {
                if(hasStarted && hasEnded && promotionEnd <= now) {
                    filteredPromotions.push(promotion);

                } else if(hasStarted && !hasEnded && promotionStart <= now && now < promotionEnd) {
                    filteredPromotions.push(promotion);

                } else if(!hasStarted && !hasEnded && now < promotionStart) {
                    filteredPromotions.push(promotion);
                }

                continue;
            }
            if(hasStarted !== undefined) {
                if(hasStarted && promotionStart <= now) {
                    filteredPromotions.push(promotion);

                } else if(!hasStarted && now < promotionStart) {
                    filteredPromotions.push(promotion);
                }

                continue;
            }
            if(hasEnded !== undefined) {
                if(hasEnded && promotionEnd <= now) {
                    filteredPromotions.push(promotion);

                } else if(!hasEnded && now < promotionEnd) {
                    filteredPromotions.push(promotion);
                }
                
                continue;
            }
            filteredPromotions.push(promotion);
        }
        const count = filteredPromotions.length;
        const toBeReturned = filteredPromotions.slice((page - 1) * limit, (page - 1) * limit + limit);
        let toReturn = [];
        if(higherRoles.includes(req.auth.role)) {
            for(let i = 0; i < toBeReturned.length; i++) {
                toReturn.push({
                    "id": toBeReturned[i].id,
                    "name": toBeReturned[i].name,
                    "location": toBeReturned[i].location,
                    "startTime": toBeReturned[i].startTime,
                    "endTime": toBeReturned[i].endTime,
                    "capacity": toBeReturned[i].capacity,
                    "pointsRemain": toBeReturned[i].pointsRemain,
                    "pointsAwarded": toBeReturned[i].pointsAwarded,
                    "published": toBeReturned[i].published,
                    "numGuests": toBeReturned[i].guests.length,
                    "placeId": toBeReturned[i].placeId
                });
            }
        } else {
            for(let i = 0; i < toBeReturned.length; i++) {
                if(toBeReturned[i].published) {
                    console.log("regular or cashier btw");
                    toReturn.push({
                        "id": toBeReturned[i].id,
                        "name": toBeReturned[i].name,
                        "location": toBeReturned[i].location,
                        "startTime": toBeReturned[i].startTime,
                        "endTime": toBeReturned[i].endTime,
                        "capacity": toBeReturned[i].capacity,
                        "numGuests": toBeReturned[i].guests.length,
                        "placeId": toBeReturned[i].placeId
                    });
                }
            }
        }
        console.log(req.auth.role);
        console.log("AFTER FILTER =========================================================================");
        console.log("get all events toReturn.length: ", toReturn.length);
        console.log("toReturn: ", toReturn);
        return res.status(200).json({"count": count, "results": toReturn});
    });

router.post('/:eventId/organizers', auth, async (req, res) => {
    const authorized = ["manager", "superuser"];
    if(!authorized.includes(req.auth.role)) {
        return res.status(403).json({"message": "Forbidden"});
    }
    const {utorid} = req.body;
    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid,
        }
    });
    if(!user) {
        return res.status(404).json({"message": "User not found"});
    }
    const eventId = parseInt(req.params.eventId);
    if(!eventId || isNaN(eventId)) {
        return res.status(404).json({"message": "Bad request"});
    }

    const event = await prisma.event.findUnique({
        where: {
            id: eventId,
        },
        include: {
            guests: true
        }
    });

    if(!event) {
        return res.status(404).json({"message": "Event not found"});
    }
    if(Date.parse(event.endTime) <= Date.now()) {
        return res.status(410).json({"message": "Event has ended"});
    }
    if(event.guests.some(u => u.id === user.id)) {
        return res.status(400).json({"message": "User is an attendee"});
    }

    const updated = await prisma.event.update({
        where: {
            id: eventId
        },
        data: {
            organizers: {
                connect: {utorid: utorid}
            }
        },
        include: {organizers: true}
    });

    await prisma.user.update({
        where: {
            utorid: utorid,
        },
        data: {
            organizedEvents: {
                connect: {id: eventId}
            }
        }
    });
    if(!updated) {
        return res.status(500).json({"message": "Something went wrong"});
    }

    return res.status(201).json({
        "id": eventId,
        "name": updated.name,
        "location": updated.location,
        "organizers": updated.organizers,
    });

});

router.delete('/:eventId/organizers/:utorid', auth, async (req, res) => {
    const higherRoles = ["manager", "superuser"];
    if(!higherRoles.includes(req.auth.role)) {
        return res.status(403).json({"message": "Forbidden"});
    }

    const eventId = parseInt(req.params.eventId);
    const utorid = req.params.utorid;
    const event = await prisma.event.findUnique({
        where: {
            id: eventId,
        },
        include: {
            organizers: true
        }
    });
    const user = await prisma.user.findUnique({
        where: {
            utoriid: utorid,
        }
    });

    if(!user || !event) {
        return res.status(404).json({"message": "User or Event not found"});
    }

    await prisma.event.update({
        where: {
            id: eventId,
        },
        data: {
            organizers: {
                disconnect: {utorid: utorid}
            }
        }
    });
    return res.status(204).json({"message": "Successfully removed organizer"});
});

router.post('/:eventId/guests', auth, async (req, res) => {
    const higherRoles = ["manager", "superuser"];
    const eventId = parseInt(req.params.eventId);
    const { utorid } = req.body;
    const event = await prisma.event.findUnique({
        where: {
            id: eventId,
        },
        include: {
            organizers: true,
            guests: true
        }
    });
    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid
        }
    });
    if(!user || !event) {
        return res.status(404).json({"message": "User or Event not found"});
    }
    if(event.organizers.some(u => u.id === user.id)) {
        return res.status(400).json({"message": "User is an organizer"});
    }
    if(!event.organizers.some(u => u.id === req.auth.id) && !higherRoles.includes(req.auth.role)) {
        return res.status(403).json({"message": "Forbidden"});
    }
    if(event.organizers.some(u => u.id === req.auth.id) && !event.published) {
        return res.status(404).json({"message": "Cannot find event"});
    }
    if(event.capacity !== null && event.guests.length === event.capacity) {
        return res.status(410).json({"message": "Event has reached capacity"});
    }
    if(Date.parse(event.endTime) <= Date.now()) {
        return res.status(410).json({"message": "Event has ended"});
    }
    let data = {guests: { connect: {utorid: utorid} } }
    if(event.capacity !== null && event.capacity !== undefined) {
        if(event.guests.length === event.capacity - 1) {
            data.full = true;
        }
    }
    const updated = await prisma.event.update({
        where: {
            id: eventId,
        },
        data: data,
        include: {
            organizers: true,
            guests: true
        }
    });
    if(!updated) {
        return res.status(500).json({"message": "Something went wrong"});
    }
    if(updated.capacity !== null && updated.guests.length === updated.capacity) {
        await prisma.event.update({
            where: {
                id: eventId,
            },
            data: {
                full: true
            }
        });
    }
    return res.status(201).json({
        "id": updated.id,
        "name": updated.name,
        "location": updated.location,
        "guestAdded": {
            "id": user.id,
            "utorid": utorid,
            "name": user.name
        },
        "numGuests": updated.guests.length
    });
});

router.route('/:eventId/guests/me')
    .post(auth, async (req, res) => {
        if(req.auth.role !== "regular") {
            return res.status(403).json({"message": "Forbidden"});
        }
        const eventId = parseInt(req.params.eventId);
        const userId = req.auth.id;
        if(isNaN(eventId)) {
            return res.status(400).json({"message": "Bad request"});
        }
        const event = await prisma.event.findUnique({
            where: {
                id: eventId
            },
            include: {
                guests: true
            }
        });
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        })
        if(!event || !user) {
            return res.status(404).json({"message": "Event not found"});
        }
        if(event.guests.some(u => u.id === userId)) {
            return res.status(400).json({"message": "User already on guest list"});
        }
        if((event.capacity !== null && event.guests.length >= event.capacity) || (Date.parse(event.endTime) <= Date.now())) {
            return res.status(410).json({"message": "Event is full or has ended"});
        }
        let data = {guests: { connect: {id: userId} } }
        if(event.capacity !== null && event.capacity !== undefined) {
            if(event.guests.length === event.capacity - 1) {
                data.full = true;
            }
        }
        const updated = await prisma.event.update({
            where: {
                id: eventId,
            },
            data: data,
            include: {
                guests: true
            }
        });
        if(!updated) {
            return res.status(500).json({"message": "Something went wrong"});
        }
        if(updated.capacity !== null && updated.guests.length === updated.capacity) {
            await prisma.event.update({
                where: {
                    id: eventId,
                },
                data: {
                    full: true
                }
            });
        }
        return res.status(201).json({
            "id": eventId,
            "name": updated.name,
            "location": updated.location,
            "guestAdded": {
                "id": userId,
                "utorid": user.utorid,
                "name": user.name
            },
            "numGuests": updated.guests.length
        });
    })
    .delete(auth, async (req, res) => {
        if(req.auth.role !== "regular") {
            return res.status(403).json({"message": "Forbidden"});
        }
        const eventId = parseInt(req.params.eventId);
        const userId = req.auth.id;
        if(isNaN(eventId)) {
            return res.status(400).json({"message": "Bad request"});
        }
        const event = await prisma.event.findUnique({
            where: {
                id: eventId,
            },
            include: {
                guests: true
            }
        });
        if(!event) {
            return res.status(404).json({"message": "Event not found"});
        }
        if(!event.guests.some(u => u.id === userId)) {
            return res.status(404).json({"message": "User is not on guest list"});
        }
        if(Date.parse(event.endTime) <= Date.now()) {
            return res.status(410).json({"message": "Event has ended"});
        }
        const updated = await prisma.event.update({
            where: {
                id: eventId,
            },
            data: {
                guests: {
                    disconnect: {
                        id: userId
                    }
                }
            },
            include: {
                guests: true
            }
        });
        if(!updated) {
            return res.status(500).json({"message": "Something went wrong"});
        }
        if(updated.capacity !== null && updated.guests.length <= updated.capacity) {
            await prisma.event.update({
                where: {
                    id: eventId,
                },
                data: {
                    full: false
                }
            });
        }
        return res.status(204).json({"message": "User successfully deleted"});
    });

router.delete('/:eventId/guests/:utorid', auth, async (req, res) => {
    const higherRoles = ["manager", "superuser"];
    if(!higherRoles.includes(req.auth.role)) {
        return res.status(403).json({"message": "Forbidden"});
    }
    const eventId = parseInt(req.params.eventId);
    const utorid = req.params.utorid;
    if(isNaN(eventId)) {
        return res.status(400).json({"message": "Bad request"});
    }
    const event = await prisma.event.findUnique({
        where: {
            id: eventId
        },
        include: {
            guests: {
                select: {
                    id: true,
                    utorid: true,
                    name: true
                }
            }
        }
    });
    const user = await prisma.user.findUnique({
        where: {
            utorid: utorid
        }
    });
    if(!user || !event) {
        return res.status(404).json({"message": "User or Event not found"});
    }
    if(!event.guests.some(u => u.id === user.id)) {
        return res.status(400).json({"message": "User is not a guest"});
    }
    const updated = await prisma.event.update({
        where: {
            id: eventId,
        },
        data: {
            guests: {
                disconnect: {utorid: utorid}
            }
        },
        include: {
            guests: true
        }
    });
    if(!updated) {
        return res.status(500).json({"message": "Something went wrong"});
    }
    if(updated.capacity !== null && updated.guests.length <= updated.capacity) {
        await prisma.event.update({
            where: {
                id: eventId,
            },
            data: {
                full: false
            }
        });
    }
    return res.status(204).json({"message": "Successfully removed guest"});
});

router.route('/:eventId')
    .get(auth, async (req, res) => {
        const eventId = parseInt(req.params.eventId);
        if(isNaN(eventId)) {
            return res.status(400).json({"message": "Bad request"});
        }
        const event = await prisma.event.findUnique({
            where: {
                id: eventId
            },
            include: {
                organizers: true,
                guests: true,
            }
        });
        if(!event) {
            return res.status(404).json({"message": "No event found."});
        }

        const lowerRoles = ["regular", "cashier"];
        const organizers = event.organizers;
        const guestCount = event.guests.length;
        let organizerIds = [];
        for(let i = 0; i < organizers.length; i++) {
            organizerIds.push(organizers[i].id);
        }
        if(lowerRoles.includes(req.auth.role) && !organizerIds.includes(req.auth.id)) {
            res.status(200).json({
                "id": event.id,
                "name": event.name,
                "description": event.description,
                "location": event.location,
                "startTime": event.startTime,
                "endTime": event.endTime,
                "capacity": event.capacity,
                "organizers": event.organizers,
                "numGuests": guestCount,
                "attending": (event.guests.find((u) => u.id === req.auth.id)),
                "placeId": event.placeId
            });
        } else {
            res.status(200).json({
                "id": event.id,
                "name": event.name,
                "description": event.description,
                "location": event.location,
                "startTime": event.startTime,
                "endTime": event.endTime,
                "capacity": event.capacity,
                "pointsRemain": event.pointsRemain,
                "pointsAwarded": event.pointsAwarded,
                "published": event.published,
                "organizers": event.organizers,
                "guests": event.guests,
                "placeId": event.placeId
            });
        }
    })
    .patch(auth, async (req, res) => {
        const eventId = parseInt(req.params.eventId);
        if(isNaN(eventId)) {
            return res.status(400).json({"message": "eventId is NaN"});
        }
        let event = await prisma.event.findUnique({
            where: {
                id: eventId,
            },
            include: {
                organizers: true
            }
        });
        if(!event) {
            return res.status(404).json({"message": "No event found."});
        }

        let organizerIds = [];
        for(let i = 0; i < event.organizers.length; i++) {
            organizerIds.push(event.organizers[i].id);
        }
        const higherRoles = ["manager", "superuser"];
        console.log(req.auth.id);
        console.log(organizerIds);
        if(!higherRoles.includes(req.auth.role) && !organizerIds.includes(req.auth.id)) {
            return res.status(403).json({"message": "Forbidden"});
        }

        let {name, description, location, startTime, endTime, capacity, points, published, placeId} = req.body;
        console.log("req.body");
        console.log(req.body);
        console.log(published);
        if((points || (published)) && req.auth.role !== "manager") {
            return res.status(403).json({"message": "Forbidden"});
        }
        if(!name && !description && !location && !startTime && !endTime && !capacity && !points && !placeId && (published === null)) {
            return res.status(400).json({"message": "No values to update"});
        }

        let data = {};
        if(placeId) {
            data.placeId = placeId;
        }
        if(name) {
            data.name = name;
        }
        if(description) {
            data.description = description;
        }
        if(location) {
            data.location = location;
        }
        if(startTime) {
            const validStart = isValidISODate(startTime);
            if(validStart) {
                if(Date.parse(startTime) <= Date.now()) {
                    return res.status(400).json({"message": "Bad start time"});
                } else {
                    data.startTime = startTime;
                }
            } else {
                return res.status(400).json({"message": "Invalid startTime"});
            }
        }
        if(endTime) {
            const validEnd = isValidISODate(endTime);
            if(validEnd) {
                if(Date.parse(endTime) < Date.now()) {
                    return res.status(400).json({"message": "Bad end time"});
                } else {
                    data.endTime = endTime;
                }
            } else {
                return res.status(400).json({"message": "Invalid endTime"});
            }
        }
        if(capacity || capacity === 0) {
            if(isNaN(capacity) || capacity < 1) {
                return res.status(400).json({"message": "Capacity is not positive"});
            } else {
                data.capacity = capacity;
            }
        }
        if(points) {
            if(event.pointsAwarded >= points  || points < 0) {
                return res.status(400).json({"message": "Bad points"});
            } else {
                data.pointsRemain = points;
            }
        }
        if(published === false || published === true) {
            console.log(published);
            if(!published) {
                return res.status(400).json({"message": "A published event cannot be unpublished"});
            } else {
                data.published = published;
            }
        }
        if(Date.parse(event.startTime) <= Date.now() && (name || description || location || startTime || capacity)) {
            return res.status(400).json({"message": "Can't change name, description, location, capacity, or startTime after event starts"});
        }
        if(Date.parse(event.endTime) <= Date.now() && (endTime)) {
            return res.status(400).json({"message": "Can't change details after event end"});
        }
        event = await prisma.event.update({
            where: {
                id: eventId,
            },
            data: data
        });
        let toReturn = {};
        toReturn["id"] = eventId;
        toReturn["name"] = event.name;
        toReturn["location"] = event.location;
        if(startTime) {
            toReturn["startTime"] = startTime;
        }
        if(endTime) {
            toReturn["endTime"] = endTime;
        }
        if(capacity) {
            toReturn["capacity"] = capacity;
        }
        if(points) {
            toReturn["points"] = points;
        }
        if(published) {
            toReturn["published"] = published;
        }
        if(points) {
            toReturn["pointsRemain"] = points;
        }
        if(placeId) {
            toReturn["placeId"] = placeId;
        }
        return res.status(200).json(toReturn);
    })
    .delete(auth, async (req, res) => {
        const eventId = parseInt(req.params.eventId);
        if(isNaN(eventId)) {
            return res.status(400).json({"message": "Bad request"});
        }
        const authorized = ["manager", "superuser"];
        if(!authorized.includes(req.auth.role)) {
            return res.status(403).json({"message": "Forbidden"});
        }
        const event = await prisma.event.findUnique({
            where: {
                id: eventId,
            }
        });
        if(!event) {
            return res.status(404).json({"message": "Event not found"});
        }
        if(event.published) {
            return res.status(400).json({"message": "Event cannot be deleted after being published"});
        }
        await prisma.event.delete({
            where: {
                id: eventId,
            }
        });
        return res.status(204).json({"message": "Event deleted"});
    });

router.post('/:eventId/transactions', auth, async (req, res) => {
    const eventId = parseInt(req.params.eventId);
    if(isNaN(eventId)) {
        return res.status(400).json({"message": "Bad request"});
    }
    const event = await prisma.event.findUnique({
        where: {
            id: eventId,
        },
        include: {
            organizers: true,
            guests: true
        }
    });
    if(!event) {
        return res.status(404).json({"message": "Event not found"});
    }
    const organizers = event.organizers;
    let organizerIds = [];
    for(let i = 0; i < organizers.length; i++) {
        organizerIds.push(organizers[i].id);
    }
    const higherRoles = ["manager", "superuser"];
    if(!higherRoles.includes(req.auth.role) && !organizerIds.includes(req.auth.id)) {
        return res.status(403).json({"message": "Forbidden"});
    }
    let {type, utorid, amount, remark} = req.body;
    if(!type || type !== "event") {
        return res.status(400).json({"message": "Bad request"});
    }
    if(!amount || isNaN(amount) || amount < 0) {
        return res.status(400).json({"message": "Bad request"});
    }
    if(!remark) {
        remark = "";
    }
    let requiredPoints = 0;
    if(utorid) {
        if(event.guests.some(u => u.utorid === utorid)) {
            requiredPoints = amount;
        } else {
            return res.status(400).json({"message": "Bad request"});
        }
    } else {
        requiredPoints = event.guests.length * amount;
    }
    if(requiredPoints > event.pointsRemain) {
        return res.status(400).json({"message": "Bad request"});
    }
    let data = {};
    if(utorid) {
        const transaction = await prisma.transaction.create({
            data: {
                type: type,
                spent: 0,
                amount: amount,
                remark: remark,
                createdBy: req.auth.utorid,
                issuer: {connect: {id: req.auth.id}},
                receiver: {connect: {utorid: utorid}},
                relatedId: eventId
            }
        });
        data["id"] = transaction.id;
        data["recipient"] = utorid;
        data["awarded"] = amount;
        data["type"] = type;
        data["relatedId"] = eventId;
        data["remark"] = remark;
        data["createdBy"] = req.auth.utorid;
        await prisma.user.update({
            where: {
               utorid: utorid
            },
            data: {
                points: {increment: amount},

            }
        });
        await prisma.event.update({
            where: {
                id: eventId,
            },
            data: {
                pointsAwarded: {increment: amount},
                pointsRemain: {decrement: amount},
            }
        });
        return res.status(201).json(data);
    } else {
        let returnArray = [];
        for(let i = 0; i < event.guests.length; i++) {
            let transaction = await prisma.transaction.create({
                data: {
                    type: type,
                    spent: 0,
                    amount: amount,
                    remark: remark,
                    createdBy: req.auth.utorid,
                    issuer: {connect: {id: req.auth.id}},
                    receiver: {connect: {utorid: event.guests[i].utorid}},
                    relatedId: eventId
                }
            });
            await prisma.event.update({
                where: {
                    id: eventId,
                },
                data: {
                    pointsAwarded: {increment: amount},
                    pointsRemain: {decrement: amount},
                }
            });
            await prisma.user.update({
                where: {
                    utorid: event.guests[i].utorid,
                },
                data: {
                    points: {increment: amount}
                }
            });
            let data = {};
            data["id"] = transaction.id;
            data["recipient"] = event.guests[i].utorid;
            data["awarded"] = amount;
            data["type"] = type;
            data["relatedId"] = eventId;
            data["remark"] = remark;
            data["createdBy"] = req.auth.utorid;
            returnArray.push(data);
        }
        return res.status(201).json(returnArray);
    }
});

module.exports = router;