import "dotenv/config"
import express from "express";

//------Prisma DB------------
import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
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
            username: username
        }
    })

    if(userExist) {
        return res.json({
            message: "username already taken, try diff username"
        })
    }

})

app.listen(3000)