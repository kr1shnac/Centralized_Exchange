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

app.post("/order", authMiddleware, async (req, res) => {
    const userId = (req as any).userId;
    const {symbol, side, price, qty, type} = req.body;

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    })

    if(!user) {
        return res.status(401).json({
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
        return res.status(401).json({
            message: `${symbol} is not present`
        })
    }

    const userBalance = BALANCE[userId].INR.available;

    if(userBalance < price * qty) {
        return res.status(401).json({
            message: "Insufficient balance"
        })
    }

    
})

app.listen(3000)