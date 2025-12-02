'use strict';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// --- Helper Data and Functions ---

/**
 * Generates a mock UofT email from a utorid.
 * @param {string} utorid
 * @returns {string}
 */
const getEmail = (utorid) => `${utorid}@mail.utoronto.ca`;

/**
 * Creates a DateTime object for a future time.
 * @param {number} daysOffset
 * @returns {string}
 */
const futureDate = (daysOffset) => new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();

/**
 * Creates a DateTime object for a past time.
 * @param {number} daysOffset
 * @returns {string}
 */
const pastDate = (daysOffset) => new Date(Date.now() - daysOffset * 24 * 60 * 60 * 1000).toISOString();

/**
 * Adds milliseconds to an ISO date string and returns a new ISO string.
 * @param {string} isoDateString
 * @param {number} milliseconds
 * @returns {string}
 */
const addMilliseconds = (isoDateString, milliseconds) => {
    return new Date(new Date(isoDateString).getTime() + milliseconds).toISOString();
};

/**
 * Calculates purchase points (1 point per 25 cents spent, rounded).
 * @param {number} spent
 * @returns {number}
 */
const calculatePurchasePoints = (spent) => Math.round(spent / 0.25);

/**
 * Main seeding function.
 */
async function main() {
    console.log('Start seeding...');

    // Clear existing data (in correct order due to foreign key constraints)
    await prisma.transaction.deleteMany();
    await prisma.promotion.deleteMany();
    await prisma.event.deleteMany();
    await prisma.resetToken.deleteMany();
    await prisma.user.deleteMany();
    console.log('Cleared existing data.');

    // 1. --- Create 20 Users ---
    const hashedPassword = await bcrypt.hash('Password123!', SALT_ROUNDS);

    // Define users with roles and initial point balances
    const userData = [
        // Staff Users (ID 1-7)
        { utorid: 'supersu1', name: 'Super Admin', role: 'superuser', points: 1000, verified: true },
        { utorid: 'manager1', name: 'Mandy Manager', role: 'manager', points: 500, verified: true },
        { utorid: 'manager2', name: 'Mike Manager', role: 'manager', points: 0, verified: true },
        { utorid: 'manager3', name: 'Megan Manager', role: 'manager', points: 200, verified: true },
        { utorid: 'cashier1', name: 'Clara Cashier', role: 'cashier', points: 100, verified: true, suspicious: true }, // Suspicious cashier for testing
        { utorid: 'cashier2', name: 'Chris Cashier', role: 'cashier', points: 100, verified: true },
        { utorid: 'cashier3', name: 'Carl Cashier', role: 'cashier', points: 100, verified: true },

        // Regular Users (ID 8-20)
        { utorid: 'reguser1', name: 'Alice Regular', role: 'regular', points: 3000, verified: true },
        { utorid: 'reguser2', name: 'Bob Regular', role: 'regular', points: 50, verified: true },
        { utorid: 'reguser3', name: 'Charlie NoTx', role: 'regular', points: 100, verified: true }, // 0 transactions
        { utorid: 'reguser4', name: 'Diana Verified', role: 'regular', points: 1250, verified: true },
        { utorid: 'reguser5', name: 'Evan Unverified', role: 'regular', points: 400, verified: false },
        { utorid: 'reguser6', name: 'Fiona Points', role: 'regular', points: 800, verified: true },
        { utorid: 'reguser7', name: 'George LowP', role: 'regular', points: 50, verified: true },
        { utorid: 'reguser8', name: 'Hannah HighP', role: 'regular', points: 7000, verified: true },
        { utorid: 'reguser9', name: 'Ian Transfer', role: 'regular', points: 2000, verified: true },
        { utorid: 'reguser10', name: 'Jodie Transfer', role: 'regular', points: 100, verified: true },
        { utorid: 'reguser11', name: 'Kyle Event', role: 'regular', points: 0, verified: true },
        { utorid: 'reguser12', name: 'Laura Event', role: 'regular', points: 0, verified: true },
        { utorid: 'reguser13', name: 'Mark Redemption', role: 'regular', points: 600, verified: true },
    ];

    const users = await prisma.$transaction(
        userData.map(user =>
            prisma.user.create({
                data: {
                    ...user,
                    email: getEmail(user.utorid),
                    password: hashedPassword,
                    activated: true,
                    lastLogin: pastDate(1),
                    // utorid and name are already set
                },
            })
        )
    );
    console.log(`Created ${users.length} users.`);

    // Mapping user IDs for easier relational data creation
    const userMap = users.reduce((acc, user) => ({ ...acc, [user.utorid]: user }), {});
    const superuserId = userMap['supersu1'].id;
    const manager1Id = userMap['manager1'].id;
    const cashier1Id = userMap['cashier1'].id;
    const regular1Id = userMap['reguser1'].id;
    const regular4Id = userMap['reguser4'].id;
    const regular5Id = userMap['reguser5'].id;
    const regular9Id = userMap['reguser9'].id;
    const regular10Id = userMap['reguser10'].id;
    const regular13Id = userMap['reguser13'].id;


    // 2. --- Create 6 Events ---
    const eventData = [
        {
            name: 'Welcome Social', description: 'A casual meet-and-greet event.', location: 'Hart House',
            startTime: pastDate(10), endTime: pastDate(9), capacity: 50, pointsRemain: 500, published: true,
            organizers: [{ id: manager1Id }], guests: [{ id: regular1Id }, { id: regular4Id }, { id: regular9Id }]
        },
        {
            name: 'Coding Workshop', description: 'Deep dive into Express.js.', location: 'BA 2250',
            startTime: pastDate(5), endTime: addMilliseconds(pastDate(5), 3600000), capacity: 100, pointsRemain: 1000, published: true,
            organizers: [{ id: superuserId }, { id: manager1Id }], guests: [{ id: regular13Id }]
        },
        {
            name: 'Spring Gala', description: 'Annual fancy dinner.', location: 'Convocation Hall',
            startTime: futureDate(14), endTime: addMilliseconds(futureDate(14), 7200000), capacity: 200, pointsRemain: 3000, published: true,
            organizers: [{ id: superuserId }], guests: []
        },
        {
            name: 'Unpublished Demo', description: 'Secret event for staff only.', location: 'Staff Lounge',
            startTime: futureDate(2), endTime: futureDate(3), capacity: 10, pointsRemain: 100, published: false,
            organizers: [{ id: manager1Id }], guests: []
        },
        {
            name: 'Full RSVP Event', description: 'A small, fully booked session.', location: 'BA 1100',
            startTime: futureDate(1), endTime: addMilliseconds(futureDate(1), 1800000), capacity: 2, pointsRemain: 100, published: true,
            organizers: [{ id: superuserId }], guests: [{ id: regular1Id }, { id: regular4Id }], full: true
        },
        {
            name: 'Unlimited Capacity Talk', description: 'A large, open talk on AI.', location: 'Online',
            startTime: futureDate(7), endTime: addMilliseconds(futureDate(7), 3600000), capacity: null, pointsRemain: 5000, published: true,
            organizers: [{ id: manager1Id }], guests: [{ id: regular5Id }]
        },
    ];

    const events = await prisma.$transaction(
        eventData.map(event =>
            prisma.event.create({
                data: {
                    ...event,
                    organizers: { connect: event.organizers },
                    guests: { connect: event.guests },
                },
            })
        )
    );
    console.log(`Created ${events.length} events.`);

    const event1Id = events[0].id; // Past event
    const event2Id = events[1].id; // Past event
    const event3Id = events[2].id; // Future published event
    const event4Id = events[3].id; // Future unpublished event


    // 3. --- Create 15 Promotions ---
    const promotionData = [
        // Automatic Promotions (ID 1-8)
        { name: 'Fall Bonus', description: '10% bonus rate on all purchases.', type: 'automatic',
            startTime: pastDate(30), endTime: futureDate(10), minSpending: 10.0, rate: 0.1, points: 0 },
        { name: 'Weekend Coffee', description: '5 bonus points on weekend spending.', type: 'automatic',
            startTime: pastDate(5), endTime: pastDate(2), minSpending: 5.0, rate: 0.0, points: 5 }, // Ended
        { name: 'Big Spender', description: 'Extra points for large purchases.', type: 'automatic',
            startTime: pastDate(15), endTime: futureDate(60), minSpending: 50.0, rate: 0.0, points: 50 },
        { name: 'New Year Kickoff', description: 'Expired promotion example.', type: 'automatic',
            startTime: pastDate(365), endTime: pastDate(300), minSpending: 0, rate: 0.0, points: 20 }, // Expired
        { name: 'Mid-Term Boost', description: '5% bonus rate, no minimum.', type: 'automatic',
            startTime: pastDate(7), endTime: futureDate(21), minSpending: null, rate: 0.05, points: 0 },
        { name: 'High Min Spend', description: 'Must spend a lot for this.', type: 'automatic',
            startTime: futureDate(1), endTime: futureDate(100), minSpending: 100.0, rate: 0.05, points: 0 },
        { name: 'Points Only Auto', description: 'Just 10 bonus points.', type: 'automatic',
            startTime: pastDate(1), endTime: futureDate(10), minSpending: 0, rate: 0.0, points: 10 },
        { name: 'Future Auto', description: 'Will start next month.', type: 'automatic',
            startTime: futureDate(30), endTime: futureDate(40), minSpending: 5.0, rate: 0.1, points: 0 },

        // One-Time Promotions (ID 9-15)
        { name: 'First Purchase Bonus', description: '100 points on your first purchase.', type: 'onetime',
            startTime: pastDate(30), endTime: futureDate(100), minSpending: 0, rate: 0.0, points: 100,
            users: [{ id: regular5Id }] }, // Unused by reguser5
        { name: 'Buy Two Get One', description: 'Used one-time promotion.', type: 'onetime',
            startTime: pastDate(30), endTime: futureDate(100), minSpending: 15.0, rate: 0.0, points: 50,
            users: [{ id: regular1Id }] }, // Used by reguser1
        { name: 'VIP Upgrade', description: 'Special one-time bonus.', type: 'onetime',
            startTime: pastDate(10), endTime: futureDate(90), minSpending: 0, rate: 0.0, points: 200,
            users: [{ id: regular4Id }, { id: regular10Id }] }, // Unused by reguser4/reguser10
        { name: 'Summer Special', description: 'Used one-time, expired.', type: 'onetime',
            startTime: pastDate(60), endTime: pastDate(20), minSpending: 1.0, rate: 0.0, points: 10,
            users: [{ id: regular13Id }] }, // Used and Expired
        { name: 'Transfer Reward', description: 'Bonus for transferring points.', type: 'onetime',
            startTime: pastDate(1), endTime: futureDate(50), minSpending: 0, rate: 0.0, points: 50,
            users: [{ id: regular9Id }] }, // Unused by reguser9
        { name: 'Redeem Bonus', description: 'Extra benefit for redemption.', type: 'onetime',
            startTime: pastDate(1), endTime: futureDate(50), minSpending: 0, rate: 0.0, points: 500,
            users: [{ id: regular13Id }] }, // Unused by reguser13
        { name: 'Super Bonus', description: 'A massive one-time point award.', type: 'onetime',
            startTime: pastDate(10), endTime: futureDate(10), minSpending: 100, rate: 0.0, points: 1000,
            users: [] } // No users assigned yet
    ];

    const promotions = await prisma.$transaction(
        promotionData.map(promo =>
            prisma.promotion.create({
                data: {
                    ...promo,
                    users: { connect: promo.users?.map(u => ({ id: u.id })) || [] },
                },
            })
        )
    );
    console.log(`Created ${promotions.length} promotions.`);

    const promo1Id = promotions[0].id; // Fall Bonus (Automatic)
    const promo3Id = promotions[2].id; // Big Spender (Automatic)
    const promo9Id = promotions[8].id;  // First Purchase (Onetime, Unused)
    const promo10Id = promotions[9].id; // Buy Two Get One (Onetime, Used by reguser1)
    const promo11Id = promotions[10].id; // VIP Upgrade (Onetime, Unused)
    const promo13Id = promotions[12].id; // Transfer Reward (Onetime, Unused)

    // 4. --- Create Transactions (10 users with transactions, 1 user with 0) ---
    const transactionData = [
        // --- Purchase Transactions (Issued by Cashiers/Managers, Received by Regulars) ---
        // T1: Regular Purchase (reguser1, cashier2)
        { type: 'purchase', spent: 10.00, amount: calculatePurchasePoints(10.00), issuerId: users[5].id, receiverId: regular1Id, createdBy: users[5].utorid, processed: true },
        // T2: Purchase with Automatic Promotion (reguser1, cashier2, promo1)
        { type: 'purchase', spent: 25.00, amount: calculatePurchasePoints(25.00) + 25 * 0.1 * 4, issuerId: users[5].id, receiverId: regular1Id, createdBy: users[5].utorid, processed: true, promotions: [{ id: promo1Id }] },
        // T3: Purchase with One-Time Promotion (reguser1, cashier3, promo10) - Used promo10
        { type: 'purchase', spent: 17.50, amount: calculatePurchasePoints(17.50) + promotions[9].points, issuerId: users[6].id, receiverId: regular1Id, createdBy: users[6].utorid, processed: true, promotions: [{ id: promo10Id }] },
        // T4: Purchase by Suspicious Cashier (reguser4, cashier1) - Needs processing
        { type: 'purchase', spent: 30.00, amount: calculatePurchasePoints(30.00), issuerId: cashier1Id, receiverId: regular4Id, createdBy: users[4].utorid, processed: false, suspicious: true },
        // T5: Large Purchase with two Automatic Promos (reguser4, cashier3, promo1, promo3)
        { type: 'purchase', spent: 65.00, amount: calculatePurchasePoints(65.00) + 65 * 0.1 * 4 + promotions[2].points, issuerId: users[6].id, receiverId: regular4Id, createdBy: users[6].utorid, processed: true, promotions: [{ id: promo1Id }, { id: promo3Id }] },

        // --- Redemption Transactions (Issued by Regulars, Processed by Cashiers) ---
        // T6: Redemption (reguser13, self-issued, unprocessed)
        { type: 'redemption', spent: 0, amount: -500, issuerId: regular13Id, receiverId: regular13Id, createdBy: userMap['reguser13'].utorid, processed: false, remark: 'Unprocessed redemption' },
        // T7: Redemption (reguser8, self-issued, processed by cashier2)
        { type: 'redemption', spent: 0, amount: -1000, issuerId: users[7].id, receiverId: users[7].id, createdBy: users[7].utorid, processed: true, processedBy: users[5].utorid, remark: 'Processed redemption' },

        // --- Transfer Transactions (Issued and Received by Regulars) ---
        // T8 (Sender): Transfer (reguser9 -> reguser10)
        { type: 'transfer', spent: 0, amount: -500, issuerId: regular9Id, receiverId: regular9Id, createdBy: userMap['reguser9'].utorid, processed: true, relatedId: regular10Id, remark: 'Transfer to Jodie' },
        // T9 (Receiver): Transfer (reguser9 -> reguser10)
        { type: 'transfer', spent: 0, amount: 500, issuerId: regular9Id, receiverId: regular10Id, createdBy: userMap['reguser9'].utorid, processed: true, relatedId: regular9Id, remark: 'Received from Ian' },

        // --- Event Transactions (Issued by Organizers, Received by Guests) ---
        // T10: Event Reward (reguser1, manager1, event1)
        { type: 'event', spent: 0, amount: 150, issuerId: manager1Id, receiverId: regular1Id, createdBy: userMap['manager1'].utorid, processed: true, eventId: event1Id, remark: 'Participation prize' },
        // T11: Event Reward (reguser4, manager1, event1)
        { type: 'event', spent: 0, amount: 100, issuerId: manager1Id, receiverId: regular4Id, createdBy: userMap['manager1'].utorid, processed: true, eventId: event1Id, remark: 'Attendance bonus' },
        // T12: Event Reward (reguser13, manager1, event2)
        { type: 'event', spent: 0, amount: 200, issuerId: manager1Id, receiverId: regular13Id, createdBy: userMap['manager1'].utorid, processed: true, eventId: event2Id, remark: 'Workshop completion' },

        // --- Adjustment Transactions (Issued by Managers, Received by Regulars) ---
        // T13: Adjustment (reguser4, manager2, related to T4 - the suspicious one)
        { type: 'adjustment', spent: 0, amount: -120, issuerId: users[2].id, receiverId: regular4Id, createdBy: users[2].utorid, processed: true, relatedId: 4, remark: 'Correcting T4 over-award' },
        // T14: Adjustment (reguser5, superuser, related to T1 - random one)
        { type: 'adjustment', spent: 0, amount: 500, issuerId: superuserId, receiverId: regular5Id, createdBy: users[0].utorid, processed: true, relatedId: 1, remark: 'Welcome gift for unverified user' },
    ];

    const transactions = [];
    for (const tx of transactionData) {
        const createdTx = await prisma.transaction.create({
            data: {
                ...tx,
                // Connect promotions if present
                promotions: tx.promotions ? { connect: tx.promotions } : undefined,
            },
        });
        transactions.push(createdTx);
    }
    console.log(`Created ${transactions.length} transactions.`);


    // 5. --- Update User Points from Transactions ---
    // The goal is to set the points field on the User model correctly based on the created transactions.
    // We will re-calculate the final points for each user based on transactions that are:
    // 1. Processed (if it's a redemption)
    // 2. Not Suspicious (if it's a purchase/adjustment that was flagged but not verified)

    const userPointsMap = {}; // Map: userId -> points change total

    // Initialize all user point totals from their initial seed data (though we only care about the change)
    users.forEach(u => userPointsMap[u.id] = u.points);

    // Iterate over created transactions to simulate point changes
    transactions.forEach(tx => {
        // Only apply point changes for processed redemptions, non-suspicious purchases, adjustments, and all event/transfer types
        const shouldApply =
            (tx.type !== 'redemption' || tx.processed) &&
            (tx.type !== 'purchase' || tx.suspicious === false) && // Assuming only non-suspicious purchase points are awarded immediately
            (tx.type !== 'adjustment' || tx.suspicious === false) &&
            (tx.type !== 'event' || tx.suspicious === false);

        if (shouldApply) {
            // For all non-transfer, non-adjustment types, the point change goes to the receiver.
            // Adjustments/Purchases/Events/Redemptions only modify the receiver's balance.
            if (tx.type !== 'transfer') {
                userPointsMap[tx.receiverId] += tx.amount;
            }
                // Transfers create two transactions: sender (negative amount) and receiver (positive amount).
                // T8 (Sender) applies to sender (issuerId=receiverId=regular9Id, amount=-500)
            // T9 (Receiver) applies to receiver (receiverId=regular10Id, amount=500)
            else if (tx.type === 'transfer') {
                // If it's the sending side of the transfer (negative amount)
                if (tx.amount < 0) {
                    userPointsMap[tx.issuerId] += tx.amount;
                }
                // If it's the receiving side of the transfer (positive amount)
                else {
                    userPointsMap[tx.receiverId] += tx.amount;
                }
            }
        }

        // Special case for T4: Purchase by Suspicious Cashier, which is marked suspicious and NOT processed.
        // The points were *not* awarded in the point calculation above, so no further action is needed.
    });

    // Final update of all user points
    await Promise.all(
        users.map(u =>
            prisma.user.update({
                where: { id: u.id },
                data: { points: userPointsMap[u.id] },
            })
        )
    );
    console.log('Updated user point balances to reflect transactions.');

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
