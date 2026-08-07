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

const BALANCE = {
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
            available: 10
        }
    },
    2: {
        INR: {
            locked: 10,
            available: 10
        }
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

//my thoughts errors are not yet cleared
app.post("/order", authMiddleware, async (req, res) => {
    const userId = (req as any).userId
    const {symbol, side, price, qty, type} = req.body;

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    })

    if(!user) {
        return res.status(404).json({
            message: "user doesn't exist"
        })
    }

    //check stock present in db
    const userOrder = await prisma.stock.findUnique({
        where: {
            symbol: symbol
        }
    })

    if(!userOrder) {
        return res.status(404).json({
            message: `${symbol} is not present`
        })
    }

    if(type === "LIMIT") {

        if(side === "BUY") {
            const userBalance = BALANCE[userId].INR.available;
    
            if(userBalance < price * qty) {
                return res.status(404).json({
                    message: "Insufficient balance"
                })
            }

            const userLocked = BALANCE[userId].INR.locked;
    
            const updateAvailable = userBalance - (price * qty)
            const updateLocked = userLocked + (price * qty)
            
            updateAvailable = updateBalance
    
            res.json({
                message: `Amount debited and your balance is ${userBalance} and ${userLocked} is locked`
            })
    
        } else {
            const userStock = BALANCE[userId].symbol.available
    
            if(userStock < price * qty) {
                return res.status(404).json({
                    message: "Insufficient stock present to sell"
                })
            }

            userStock = userStock - (qty * price);

            const userLocked = BALANCE[userId].symbol.locked;

            userLocked = userLocked + (qty * price)

            res.json({
                message: `${userStock} is placed to sell and ${userLocked} is locked`
            })
        }

    } else {
        if (side === "BUY") {
            const userBalance = BALANCE[userId].INR.available;

            if(userBalance < price * qty) {
                return res.json({
                    message: "insufficient balance"
                })
            }

            userBalance = userBalance - (price * qty)

            return res.json({
                message: "Amount deducted"
            })
        } else {
            const userStock = BALANCE[userId].symbol.available;

            if(userStock < price * qty) {
                return res.status(404).json({
                    message: "insuffient stocks present to sell"
                })
            }

            userStock = userStock - (price * qty)

            return res.json({
                message: `user sold your stock at ${userStock}`
            })
        }
    }

    

    

    
})

app.listen(3000)