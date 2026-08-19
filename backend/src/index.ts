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

app.post("/order", authMiddleware, async (req, res) => {
    const userId = (req as any).userId;

    const { type, side, symbol, qty, price } = req.body;

    if(!type || !side || !symbol || !qty === undefined || !price === undefined) {
        return res.status(404).json({
            message: "type, side, symbol, qty, price not found"
        })
    }

    if(side !== "BUY" && side !== "SELL") {
        return res.status(403).json({
            messsage: "your side can either be BUY or SELL"
        })
    }

    if(type !== "LIMIT") {
        return res.status(403).json({
            message: "Your present logic is only LIMIt"
        })
    }

    if(qty <= 0) {
        return res.status(403).json({
            message: "quantity cant be negative"
        })
    }

    if(price <= 0) {
        return res.status(403).json({
            message: "price cant be negative"
        })
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
    })

    if(!user) {
        return res.status(404).json({
            message: "user not found"
        })
    }

    const stock = await prisma.stock.findUnique({
        where: {
            symbol: symbol
        }
    })

    if(!stock) {
        return res.status(404).json({
            message: "Stock not found"
        })
    }

    const userBalance = BALANCE[userId] 

    if(!userBalance) {
        return res.status(404).json({
            message: "Balance not found"
        })
    }

    if(type === "LIMIT") {

        if (side === "BUY") {
            const inrBalance = userBalance.INR

            if(!inrBalance) {
                return res.status(404).json({
                    message: "INR Balance not found"
                })
            }

            const requiredAmount = qty * price

            if(inrBalance.available < requiredAmount) {
                return res.status(402).json({
                    message: `You have insuffient balance short by ${requiredAmount - inrBalance.available}`
                })
            }

            inrBalance.available -= requiredAmount
            inrBalance.locked += requiredAmount
            
        } 

        if(side === "SELL") {
            const stockBalance = userBalance[symbol]

            if(!stockBalance) {
                return res.status(403).json({
                    message: "Stock balance not found"
                })
            }

            if(stockBalance.available < qty) {
                return res.status(403).json({
                    message: `Short by ${qty - stockBalance.available}, insuffient balance`
                })
            }

            stockBalance.available -= qty
            stockBalance.locked += qty
            
        }

        if(side === "BUY") {
            ORDERBOOK[userId][symbol].asks.filledQty
        }

        // ==========================================================
        // YOUR NEXT PART
        // ==========================================================
        //
        // 1. Check the opposite side of ORDERBOOK.
        // 2. Match if price conditions are satisfied.
        // 3. Calculate filledQty.
        // 4. Create fills.
        // 5. Update remainingQty.
        // 6. If LIMIT order has remaining quantity,
        //    put the remaining order onto the book.
        //
        // DO NOT implement this part by copying AI.
        //
        // ==========================================================


        //we store order in db
        const order = await prisma.order.create({
            data: {
                userId,
                stockId: stock.id,
                side,
                price,
                qty,
                filledQty: 0,
                type: "LIMIT",
                status: "OPEN",
            }
        })

        const responseBalance = side === "BUY" ? userBalance.INR : userBalance.symbol

        res.status(201).json({
            message: `Limit ${side} order created successfully`,
            order,
            balance: responseBalance
            // balance: {
            //     available: userBalance[INR].available,
            //     locked: userBalance[INR].locked
            // } 
            //what if someone try to buy using AXIS insted of INR which is invalid 
            // so for BUY its INR for sell its symbol of stock 
        })
    }
}) 

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