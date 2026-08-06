import "dotenv/config"
import jwt from "jsonwebtoken"
import type {Request, Response, NextFunction} from "express"

interface JwtPayload {
    username: string
}

function authMiddleware (req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if(!authHeader) {
            return res.status(401).json({
                message: "no token exist, please login"
            })
        }

        const token  = authHeader.split(" ")[1];

        if(!token) {
            return res.status(401).json({
                message: "token is invalid"
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload //as {username : string}
        (req as any).username = decoded.username 

        next()
    } catch (err) {
        return res.status(401).json({
            message: "invalid or expired token"
        })
    }
}

export default authMiddleware;