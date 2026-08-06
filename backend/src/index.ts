import "dotenv/config"
import express from "express";
import jwt from "jsonwebtoken"
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

    await prisma.user.create({
        data: {
            username,
            password
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
            username,
            password
        }
    })
 
    if(!user) {
        return res.json({
            message: "incorrect login creditionals"
        })
    }

    const token = jwt.sign({
        username
    }, process.env.JWT_SECRET!)

    return res.json({
        message: username + " logged in successfully!!"
    })
})

app.listen(3000)