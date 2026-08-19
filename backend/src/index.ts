import "dotenv/config"
import express from "express";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import authMiddleware from "./middleware.js"

//------Prisma DB------------
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!
});

const prisma = new PrismaClient({
    adapter,
})
//------------------------------

//-----in memory db --------
type Asset = {
    available: number,
    locked: number
}

type Balance = {
    [userId: number]: {
        [asset: string]: Asset
    }
}

const BALANCE: Balance = {
    1: {
        AXIS: {
            locked: 10,
            available: 20
        },
        HDFC: {
            locked: 5,
            available: 15
        },
        INR: {
            locked: 10,
            available: 1000
        }
    },
    2: {
        INR: {
            locked: 10,
            available: 12220
        }
    }
}

//order book

type BookOrder = {
    userId: number,
    orderId: number,
    price: number,
    remainingQty: number,
    side: "BUY" | "SELL"
}

type MarketOrderBook = {
    bids: BookOrder[],
    asks: BookOrder[]
}

type Orderbook = {
    [symbol: string]: MarketOrderBook
}

const ORDERBOOK : Orderbook= {
    AXIS: {
        asks: [],
        bids: []
    }, 
    HDFC: {
        asks: [],
        bids: []
    }
}

const app = express()

app.use(express.json())


app.post("/signup", async (req, res) => {
    const {username, password} = req.body;

    const userExist = await prisma.user.findUnique({
        where: {
            username
        }
    })

    if(userExist) {
        return res.json({
            message: "username already taken"
        })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.create({
        data: {
            username: username,
            password: hashedPassword
        }
    }) 

    return res.json({
        message: "user successfully created"
    })

})

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
        where: {
            username //we only find users username 
        }
    })
 
    if(!user) {
        return res.json({
            message: "incorrect username"
        })
    }

    const verifyPass = await bcrypt.compare(password, user.password)

    if(!verifyPass) {
        return res.status(401).json({
            message: "incorrect password"
        })
    }

    const token = jwt.sign({
        userId: user.id
    }, process.env.JWT_SECRET!)

    return res.json({
        message: `${user.username} logged in successfully!!`,
        token: token //always return token to access in frontend
    })
})


//order

// app.post("/order", authMiddleware, async (req, res) => {
//     const userId = (req as any).userId;

//     const { type, side, symbol, qty, price } = req.body;

//     if(!type || !side || !symbol || !qty === undefined || !price === undefined) {
//         return res.status(404).json({
//             message: "type, side, symbol, qty, price not found"
//         })
//     }

//     if(side !== "BUY" && side !== "SELL") {
//         return res.status(403).json({
//             messsage: "your side can either be BUY or SELL"
//         })
//     }

//     if(type !== "LIMIT") {
//         return res.status(403).json({
//             message: "Your present logic is only LIMIt"
//         })
//     }

//     if(qty <= 0) {
//         return res.status(403).json({
//             message: "quantity cant be negative"
//         })
//     }

//     if(price <= 0) {
//         return res.status(403).json({
//             message: "price cant be negative"
//         })
//     }

//     const user = await prisma.user.findUnique({
//         where: {
//             id: userId
//         },
//     })

//     if(!user) {
//         return res.status(404).json({
//             message: "user not found"
//         })
//     }

//     const stock = await prisma.stock.findUnique({
//         where: {
//             symbol: symbol
//         }
//     })

//     if(!stock) {
//         return res.status(404).json({
//             message: "Stock not found"
//         })
//     }

//     const userBalance = BALANCE[userId] 

//     if(!userBalance) {
//         return res.status(404).json({
//             message: "Balance not found"
//         })
//     }

//     if(type === "LIMIT") {

//         if (side === "BUY") {
//             const inrBalance = userBalance.INR

//             if(!inrBalance) {
//                 return res.status(404).json({
//                     message: "INR Balance not found"
//                 })
//             }

//             const requiredAmount = qty * price

//             if(inrBalance.available < requiredAmount) {
//                 return res.status(402).json({
//                     message: `You have insuffient balance short by ${requiredAmount - inrBalance.available}`
//                 })
//             }

//             inrBalance.available -= requiredAmount
//             inrBalance.locked += requiredAmount
            
//         } 

//         if(side === "SELL") {
//             const stockBalance = userBalance[symbol]

//             if(!stockBalance) {
//                 return res.status(403).json({
//                     message: "Stock balance not found"
//                 })
//             }

//             if(stockBalance.available < qty) {
//                 return res.status(403).json({
//                     message: `Short by ${qty - stockBalance.available}, insuffient balance`
//                 })
//             }

//             stockBalance.available -= qty
//             stockBalance.locked += qty
            
//         }

//         //we store order in db
//         const order = await prisma.order.create({
//             data: {
//                 userId,
//                 stockId: stock.id,
//                 side,
//                 price,
//                 qty,
//                 filledQty: 0,
//                 type: "LIMIT",
//                 status: "OPEN",
//             }
//         })

//         const filledQty = 0

//         const remainingQty = qty - filledQty;

//         if(remainingQty > 0) {
//             const bookOrder = {
//                 userId,
//                 orderId: order.id,
//                 price,
//                 remainingQty,
//                 side
//             }

//             if(side === "BUY") {
//                 ORDERBOOK[symbol].bids.push(bookOrder);
//             } else {
//                 ORDERBOOK[symbol].asks.push(bookOrder)
//             }
//         }

//         if(side === "SELL") {
//             const asks = ORDERBOOK[symbol].asks

//             for(const restingOrder of asks) {
//                 if(restingOrder.price <= price) {

//                     const tradeQty = Math.min(
//                         remainingQty,
//                         restingOrder.remainingQty
//                     )

//                     console.log("Match Found")
//                     console.log("BUYER:", userId)
//                     console.log("SELLER:", restingOrder.userId)
//                     console.log("PRICE:", restingOrder.price)
//                     console.log("Quantity:", tradeQty)


//                     const buyerId = userId
//                     const sellerId = restingOrder.userId

//                     const tradePrice = restingOrder.price

//                     const tradeValue = tradePrice * tradeQty

//                     //BUYER
//                     const buyerBalance = BALANCE[buyerId]

//                     if(!buyerBalance) {
//                         return res.json({
//                             message: "BALANCE not found"
//                         })
//                     }

//                     const buyerINR = buyerBalance.INR

//                     if(!buyerINR) {
//                         return res.json({
//                             message: "INR Balance not found"
//                         })
//                     }

//                     buyerINR.locked -= tradeValue

//                     const buyerStock = buyerBalance[symbol]

//                     if(!buyerStock) {
//                         buyerBalance[symbol] = {
//                             available: tradeQty,
//                             locked: 0
//                         }
//                     } else {
//                         buyerStock.available += tradeQty
//                     }

//                     //update in db -> BUY
//                     const buyerOrder = await prisma.order.findUnique({
//                         where: {
//                             id: incomingOrderId
//                         }
//                     });

//                     if(!buyerOrder) {
//                         throw new Error("Buyer order not found")
//                     }

//                     await prisma.order.update({
//                         where: {
//                             id: buyerOrder.id
//                         }, 
//                         data: {
//                             filledQty: buyerOrder.filledQty + tradeQty,
//                             status: "FILLED"
//                         }
//                     })

//                     await prisma.fill.create({
//                         data: {
//                             userId: buyerId,
//                             orderId: order.id,
//                             price: tradePrice,
//                             qty: tradeQty,
//                             type: "LIMIT",
//                             side: "BUY"
//                         }
//                     })


//                     //SELLER
//                     const sellerBalance = BALANCE[sellerId]

//                     if(!sellerBalance) {
//                         throw new Error("Seller balance not found") //tried throw insted of return res.json
//                     }

//                     const sellerStock = sellerBalance[symbol]

//                     if(!sellerStock) {
//                         throw new Error("Seller stock balance is not found")
//                     }

//                     sellerStock.locked -= tradeQty

//                     const sellerINR = sellerBalance.INR

//                     if(!sellerINR) {
//                         sellerBalance.INR = {
//                             available: tradeValue,
//                             locked: 0
//                         }
//                     } else {
//                         sellerINR.available += tradeValue
//                     }

//                     const sellerOrder = await prisma.order.findUnique({
//                         where: {
//                             id: restingOrder.orderId
//                         }
//                     })

//                     if (!sellerOrder) {
//                         throw new Error("Seller order not found");
//                     }

//                     const sellerNewFilledQty = sellerOrder.filledQty + tradeQty

//                     const sellerStatus = sellerNewFilledQty === sellerOrder.qty ? "FILLED" : "OPEN"

//                     await prisma.order.update({
//                         where: {
//                             id: sellerOrder.id
//                         }, 
//                         data: {
//                             filledQty: sellerNewFilledQty,
//                             status: sellerStatus
//                         }
//                     })

//                     await prisma.fill.create({
//                         data: {
//                             userId: sellerId,
//                             orderId: sellerOrder.id,
//                             price: tradePrice,
//                             qty: tradeQty,
//                             type: "LIMIT",
//                             side: "SELL"
//                         }
//                     })

//                     //incomming buy order
//                     remainingQty -= tradeQty;
//                     filledQty += tradeQty

//                     //Existing sell order
//                     restingOrder.remainingOrder -= tradeQty
 
//                 }
//             }
//         }

//         const responseBalance = side === "BUY" ? userBalance.INR : userBalance.symbol

//         res.status(201).json({
//             message: `Limit ${side} order created successfully`,
//             order,
//             balance: responseBalance
//             // balance: {
//             //     available: userBalance[INR].available,
//             //     locked: userBalance[INR].locked
//             // } 
//             //what if someone try to buy using AXIS insted of INR which is invalid 
//             // so for BUY its INR for sell its symbol of stock 
//         })
//     }
// }) 

app.post("/order", authMiddleware, async (req, res) => {
    try {
        // ============================================================
        // 1. GET USER + ORDER DATA
        // ============================================================

        const userId = Number((req as any).userId);

        const {
            type,
            side,
            symbol,
            qty,
            price
        } = req.body;


        // ============================================================
        // 2. BASIC VALIDATION
        // ============================================================

        // CHANGE:
        // Your old condition was:
        // !qty === undefined
        // !price === undefined
        //
        // That does NOT mean "qty/price is missing".
        // We explicitly check undefined here.
        if (
            !type ||
            !side ||
            !symbol ||
            qty === undefined ||
            price === undefined
        ) {
            return res.status(400).json({
                message: "type, side, symbol, qty and price are required"
            });
        }


        // CHANGE:
        // You previously used || here.
        //
        // side !== "BUY" || side !== "SELL"
        // is always true.
        //
        // We want:
        // "if it is neither BUY nor SELL"
        if (side !== "BUY" && side !== "SELL") {
            return res.status(400).json({
                message: "Side must be BUY or SELL"
            });
        }


        // CHANGE:
        // V1 currently supports LIMIT orders only.
        if (type !== "LIMIT") {
            return res.status(400).json({
                message: "Only LIMIT orders are supported currently"
            });
        }


        // CHANGE:
        // Zero is not a valid order quantity.
        if (typeof qty !== "number" || qty <= 0) {
            return res.status(400).json({
                message: "Quantity must be greater than 0"
            });
        }


        // CHANGE:
        // Zero is not a valid LIMIT price.
        if (typeof price !== "number" || price <= 0) {
            return res.status(400).json({
                message: "Price must be greater than 0"
            });
        }


        // ============================================================
        // 3. CHECK USER
        // ============================================================

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }


        // ============================================================
        // 4. CHECK STOCK
        // ============================================================

        const stock = await prisma.stock.findUnique({
            where: {
                symbol: symbol
            }
        });

        if (!stock) {
            return res.status(404).json({
                message: `${symbol} is not present`
            });
        }


        // ============================================================
        // 5. CHECK IN-MEMORY USER BALANCE
        // ============================================================

        const userBalance = BALANCE[userId];

        if (!userBalance) {
            return res.status(404).json({
                message: "User balance not found"
            });
        }


        // ============================================================
        // 6. CHECK ORDER BOOK EXISTS FOR THIS SYMBOL
        // ============================================================

        // CHANGE:
        // Prisma told us the stock exists in DB.
        // That does NOT guarantee that the same symbol exists
        // in our in-memory ORDERBOOK.
        const market = ORDERBOOK[symbol];

        if (!market) {
            return res.status(404).json({
                message: `Order book not found for ${symbol}`
            });
        }


        // ============================================================
        // 7. RESERVE BALANCE
        // ============================================================
        //
        // IMPORTANT:
        //
        // BUY:
        //     INR is locked
        //     price × qty
        //
        // SELL:
        //     stock is locked
        //     qty
        //
        // This happens BEFORE matching because the user must have
        // enough funds/assets to support the order.
        // ============================================================


        if (side === "BUY") {

            const inrBalance = userBalance.INR;

            if (!inrBalance) {
                return res.status(400).json({
                    message: "INR balance not found"
                });
            }

            const requiredAmount = price * qty;

            if (inrBalance.available < requiredAmount) {
                return res.status(400).json({
                    message: "Insufficient INR balance",
                    available: inrBalance.available,
                    required: requiredAmount
                });
            }

            // Reserve the maximum amount the buyer may need.
            inrBalance.available -= requiredAmount;
            inrBalance.locked += requiredAmount;
        }


        if (side === "SELL") {

            const stockBalance = userBalance[symbol];

            if (!stockBalance) {
                return res.status(400).json({
                    message: `Stock balance for ${symbol} not found`
                });
            }

            if (stockBalance.available < qty) {
                return res.status(400).json({
                    message: "Insufficient stock balance",
                    available: stockBalance.available,
                    required: qty
                });
            }

            // Reserve the stock that the seller is offering.
            stockBalance.available -= qty;
            stockBalance.locked += qty;
        }


        // ============================================================
        // 8. CREATE THE INCOMING ORDER
        // ============================================================
        //
        // CHANGE:
        // Earlier you were putting the order into the book BEFORE
        // checking whether it could match.
        //
        // Correct flow:
        //
        //     create incoming order
        //              ↓
        //     check opposite side
        //              ↓
        //           match
        //              ↓
        //     remaining quantity
        //              ↓
        //     only remaining part goes into book
        //
        // So we do NOT push it into bids/asks yet.
        // ============================================================

        const order = await prisma.order.create({
            data: {
                userId: userId,
                stockId: stock.id,
                side: side,
                price: price,
                qty: qty,
                filledQty: 0,
                type: "LIMIT",
                status: "OPEN"
            }
        });


        // ============================================================
        // 9. TRACK INCOMING ORDER STATE
        // ============================================================

        // CHANGE:
        // Earlier you used const and later tried to modify it.
        //
        // Since matching changes these values,
        // they must be let.
        let filledQty = 0;
        let remainingQty = qty;


        // ============================================================
        // 10. MATCHING
        // ============================================================
        //
        // BUY:
        //     Incoming BUY checks ASKS
        //
        // SELL:
        //     Incoming SELL checks BIDS
        //
        // This is the fundamental order-book relationship:
        //
        //     BUY  ↔ ASKS
        //     SELL ↔ BIDS
        //
        // ============================================================


        const oppositeOrders =
            side === "BUY"
                ? market.asks
                : market.bids;


        // ============================================================
        // 11. BEST PRICE FIRST
        // ============================================================
        //
        // For ASKS:
        //     lowest price is the best seller
        //
        // For BIDS:
        //     highest price is the best buyer
        //
        // We sort the in-memory arrays before matching.
        //
        // This is important because your earlier array was simply
        // insertion-ordered and did not guarantee best-price priority.
        // ============================================================

        if (side === "BUY") {
            oppositeOrders.sort((a, b) => a.price - b.price);
        } else {
            oppositeOrders.sort((a, b) => b.price - a.price);
        }


        // ============================================================
        // 12. GO THROUGH RESTING ORDERS
        // ============================================================

        for (const restingOrder of oppositeOrders) {

            // CHANGE:
            // Once our incoming order is completely filled,
            // there is nothing left to match.
            if (remainingQty === 0) {
                break;
            }


            // ========================================================
            // 13. PRICE CHECK
            // ========================================================
            //
            // BUY:
            //
            //     incoming BUY @ 100
            //     seller must accept <= 100
            //
            //     resting ask <= incoming buy price
            //
            //
            // SELL:
            //
            //     incoming SELL @ 100
            //     buyer must pay >= 100
            //
            //     resting bid >= incoming sell price
            // ========================================================

            const priceMatches =
                side === "BUY"
                    ? restingOrder.price <= price
                    : restingOrder.price >= price;


            // If price doesn't cross, there is no more matching
            // possible because the book is price sorted.
            if (!priceMatches) {
                break;
            }


            // ========================================================
            // 14. DETERMINE TRADE QUANTITY
            // ========================================================
            //
            // Example:
            //
            // Incoming BUY = 10
            // Resting SELL = 4
            //
            // tradeQty = 4
            //
            // Because only 4 shares are available on the resting side.
            // ========================================================

            const tradeQty = Math.min(
                remainingQty,
                restingOrder.remainingQty
            );


            // ========================================================
            // 15. TRADE PRICE
            // ========================================================
            //
            // The execution happens at the resting order's price.
            //
            // Example:
            //
            // BUY limit = 100
            // SELL resting = 95
            //
            // Trade happens at 95.
            // ========================================================

            const tradePrice = restingOrder.price;
            const tradeValue = tradePrice * tradeQty;


            // ========================================================
            // 16. IDENTIFY BUYER AND SELLER
            // ========================================================
            //
            // CHANGE:
            // Earlier you always assumed:
            //
            //     userId = buyer
            //     restingOrder.userId = seller
            //
            // That is only true when the incoming order is BUY.
            //
            // If the incoming order is SELL, the opposite is true.
            // ========================================================

            let buyerId: number;
            let sellerId: number;

            if (side === "BUY") {
                buyerId = userId;
                sellerId = restingOrder.userId;
            } else {
                buyerId = restingOrder.userId;
                sellerId = userId;
            }


            // ========================================================
            // 17. GET BOTH USERS' BALANCES
            // ========================================================

            const buyerBalance = BALANCE[buyerId];
            const sellerBalance = BALANCE[sellerId];

            if (!buyerBalance) {
                throw new Error(`Buyer balance not found: ${buyerId}`);
            }

            if (!sellerBalance) {
                throw new Error(`Seller balance not found: ${sellerId}`);
            }


            // ========================================================
            // 18. BUYER SETTLEMENT
            // ========================================================
            //
            // BUYER already locked money when the order was created.
            //
            // We now consume the ACTUAL trade value.
            //
            // IMPORTANT:
            //
            // Buyer may have locked:
            //
            //     limitPrice × quantity
            //
            // but trade may happen at a BETTER price.
            //
            // Example:
            //
            // BUY 10 @ 100
            // executes at 90
            //
            // Locked = 1000
            // Actual cost = 900
            //
            // The extra 100 must be released back to available INR.
            // ========================================================

            const buyerINR = buyerBalance.INR;

            if (!buyerINR) {
                throw new Error(
                    `Buyer INR balance not found: ${buyerId}`
                );
            }

            // Actual amount consumed from locked funds
            buyerINR.locked -= tradeValue;


            // CHANGE:
            // Release the difference between the limit reservation
            // and the actual execution price.
            //
            // This matters when buyer gets a better price.
            const buyerReservedValue = price * tradeQty;

            const buyerRefund =
                buyerReservedValue - tradeValue;

            if (buyerRefund > 0) {
                buyerINR.available += buyerRefund;
            }


            // Buyer receives the stock.
            const buyerStock = buyerBalance[symbol];

            if (!buyerStock) {
                buyerBalance[symbol] = {
                    available: tradeQty,
                    locked: 0
                };
            } else {
                buyerStock.available += tradeQty;
            }


            // ========================================================
            // 19. SELLER SETTLEMENT
            // ========================================================
            //
            // Seller already moved:
            //
            //     available stock → locked stock
            //
            // Now the traded quantity leaves locked stock
            // and seller receives INR.
            // ========================================================

            const sellerStock = sellerBalance[symbol];

            if (!sellerStock) {
                throw new Error(
                    `Seller stock balance not found: ${sellerId}`
                );
            }

            sellerStock.locked -= tradeQty;


            const sellerINR = sellerBalance.INR;

            if (!sellerINR) {
                sellerBalance.INR = {
                    available: tradeValue,
                    locked: 0
                };
            } else {
                sellerINR.available += tradeValue;
            }


            // ========================================================
            // 20. UPDATE IN-MEMORY QUANTITIES
            // ========================================================

            remainingQty -= tradeQty;
            filledQty += tradeQty;

            restingOrder.remainingQty -= tradeQty;


            // ========================================================
            // 21. FIND RESTING ORDER FROM DATABASE
            // ========================================================

            const restingDbOrder = await prisma.order.findUnique({
                where: {
                    id: restingOrder.orderId
                }
            });

            if (!restingDbOrder) {
                throw new Error(
                    `Resting order not found: ${restingOrder.orderId}`
                );
            }


            // ========================================================
            // 22. UPDATE RESTING ORDER
            // ========================================================

            const restingNewFilledQty =
                restingDbOrder.filledQty + tradeQty;

            const restingStatus =
                restingNewFilledQty === restingDbOrder.qty
                    ? "FILLED"
                    : "OPEN";

            await prisma.order.update({
                where: {
                    id: restingDbOrder.id
                },
                data: {
                    filledQty: restingNewFilledQty,
                    status: restingStatus
                }
            });


            // ========================================================
            // 23. CREATE FILL FOR RESTING ORDER
            // ========================================================
            //
            // A Fill means:
            // "This part of the order ACTUALLY executed."
            //
            // One trade has two participants, so we eventually record
            // one Fill for each side.
            // ========================================================

            await prisma.fill.create({
                data: {
                    userId: sellerId,
                    orderId: restingDbOrder.id,
                    price: tradePrice,
                    qty: tradeQty,
                    type: "LIMIT",
                    side: restingDbOrder.side
                }
            });


            // ========================================================
            // 24. CREATE FILL FOR INCOMING ORDER
            // ========================================================

            await prisma.fill.create({
                data: {
                    userId: buyerId,
                    orderId: order.id,
                    price: tradePrice,
                    qty: tradeQty,
                    type: "LIMIT",
                    side: side === "BUY" ? "BUY" : "SELL"
                }
            });


            // ========================================================
            // 25. REMOVE RESTING ORDER IF FULLY FILLED
            // ========================================================
            //
            // CHANGE:
            // Earlier you reduced remainingQty but never removed the
            // order from the book.
            //
            // If remainingQty becomes 0, the order is no longer active.
            // ========================================================

            if (restingOrder.remainingQty === 0) {

                const index = oppositeOrders.indexOf(
                    restingOrder
                );

                if (index !== -1) {
                    oppositeOrders.splice(index, 1);
                }
            }
        }


        // ============================================================
        // 26. UPDATE INCOMING ORDER IN DATABASE
        // ============================================================

        // CHANGE:
        // Earlier you were always marking BUY as FILLED.
        //
        // Correct:
        //
        //     filledQty === qty
        //          → FILLED
        //
        //     filledQty < qty
        //          → OPEN
        //
        const incomingStatus =
            filledQty === qty
                ? "FILLED"
                : "OPEN";


        await prisma.order.update({
            where: {
                id: order.id
            },
            data: {
                filledQty: filledQty,
                status: incomingStatus
            }
        });


        // ============================================================
        // 27. IF LIMIT ORDER HAS REMAINING QUANTITY,
        //     PUT ONLY THE REMAINDER ON THE BOOK
        // ============================================================
        //
        // CHANGE:
        // Earlier you inserted the FULL order into the book BEFORE
        // matching.
        //
        // Correct:
        //
        //     match first
        //        ↓
        //     calculate remainingQty
        //        ↓
        //     only remaining quantity rests
        // ============================================================

        if (remainingQty > 0) {

            const bookOrder: BookOrder = {
                userId: userId,
                orderId: order.id,
                price: price,
                remainingQty: remainingQty,
                side: side
            };

            if (side === "BUY") {
                market.bids.push(bookOrder);
            } else {
                market.asks.push(bookOrder);
            }
        }


        // ============================================================
        // 28. RESPONSE BALANCE
        // ============================================================
        //
        // CHANGE:
        //
        // Wrong:
        //     userBalance.symbol
        //
        // That means the literal property "symbol".
        //
        // Correct:
        //     userBalance[symbol]
        //
        // BUY changes INR.
        // SELL changes the stock represented by symbol.
        // ============================================================

        const responseBalance =
            side === "BUY"
                ? userBalance.INR
                : userBalance[symbol];


        // ============================================================
        // 29. ONE FINAL RESPONSE
        // ============================================================
        //
        // CHANGE:
        // Earlier you called res.json() in the middle of the route
        // and then tried sending another response later.
        //
        // Express should receive ONE final response.
        // ============================================================

        return res.status(201).json({
            message: `Limit ${side} order processed successfully`,
            orderId: order.id,
            requestedQty: qty,
            filledQty: filledQty,
            remainingQty: remainingQty,
            status: incomingStatus,
            balance: responseBalance
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

//get user orders
app.get("/order", authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).userId

        const user = await prisma.user.findUnique({
            where: {
                id: userId //comparing db id with userId
            }
        })
    
        if(!user) {
            return res.status(403).json({
                message: "User is invalid try logging in again"
            })
        }
    
        const order = await prisma.order.findMany({
            where: {
                userId
            }, 
            orderBy: {
                createdAt: "desc",
            }
        })
    
        return res.json({
            message: `${user.username} orders are: `,
            order
        })

    } catch (err) {
        console.log(err)

        return res.status(500).json({
            message: "Internal server error"
        })
    }
    
})

//get user balance
app.get("/balance", authMiddleware, async (req, res) => {
    try {
        const userId = (req as any).userId

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        })

        if(!user) {
            return res.status(403).json({
                message: "invalid user id, login again"
            })
        }

        const getBalance = BALANCE[userId]

        if(!getBalance) {
            return res.json({
                message: "Balance not found"
            })
        }
    
        return res.json({
            Balance: getBalance
        })

    } catch (err) {
        console.log(err)

        return res.status(500).json({
            message: "Internal server error"
        })
    }
})

app.listen(3000);