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

const ORDERBOOK = {
    AXIS: {
        asks: [
            {price: 100, qty: 30},
            {price: 200, qty: 30},
            {price: 200, qty: 30},
        ],
        bids: [
            {price: 200, qty: 30},
            {price: 200, qty: 30},
            {price: 200, qty: 30},
        ]
    }, 
    HDFC: {
        asks: [
            {price: 100, qty: 30},
            {price: 200, qty: 30},
            {price: 200, qty: 30},
        ],
        bids: [
            {price: 200, qty: 30},
            {price: 200, qty: 30},
            {price: 200, qty: 30},
        ]
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

    if(side !== "BUY" || side !== "SELL") {
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

            const orderBook = ORDERBOOK[symbol]

            orderBook.asks.push({
                qty, price
            })
            
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

            const orderBook = ORDERBOOK[symbol]

            orderBook.bids.
            
        }

        //we store order in db
        const order = await prisma.order.create({
            data: {
                userId: userId,
                stockId: stock.id,
                side: side,
                price: price,
                qty: qty,
                type: type,
                status: "OPEN",
                filledQty: 0
            }
        })

        const responseBalance = side === "BUY" ? userBalance.INR : userBalance.symbol

        return res.status(201).json({
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

app.listen(3000)