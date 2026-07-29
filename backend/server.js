import express from "express"
import dotenv from "dotenv"
import cookieParser from 'cookie-parser'
import cors from 'cors'
import userRoutes from './routes/user.route.js'
import postRouters from './routes/post.route.js'
import pollRouter from './routes/poll.route.js'
import PostsPollsRoute from './routes/posts-polls.route.js'
import adminRouter from './routes/admin.route.js'
import reportRouter from './routes/report.route.js'
import aiRouter from './routes/ai.route.js'
import searchRouter from './routes/search.route.js'
import notificationRouter from './routes/notification.route.js'
import database from "./config/db.connect.js"
import { startRepeatingTrendingJob } from './queues/queue.js'
// import path from "path";
dotenv.config({})

import { app, server } from "./socket/socket.js"
import "./queues/worker.js"
const port = process.env.PORT || 3000

//Defualt middlewares
app.use(express.json())
app.use(cookieParser());

app.use(cors({
  origin: (origin, callback) => {
    // Dynamically allow requesting origin to pass the credentials check
    callback(null, true);
  },
  credentials: true
}));

app.use("/user",userRoutes)
app.use("/post",postRouters)
app.use("/poll",pollRouter)
app.use("/feed",PostsPollsRoute)
app.use("/admin",adminRouter)
app.use("/report",reportRouter)
app.use("/ai",aiRouter)
app.use("/search",searchRouter)
app.use("/notifications", notificationRouter)



// app.use(express.static(path.join(__dirname, "/frontend/dist")));
// app.get("*", (req,res)=>{
//     res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
// })


server.listen(port, "0.0.0.0", async () => {
    database();
    // Start the repeating background trending recalculation (every 2 min)
    await startRepeatingTrendingJob();
    console.log(`Server running at port ${port}`);
})


// http://localhost:8000/api/v1/user/register
//  127.0.0.1:8000
// { 
//     "username": "ahmed", 
//     "email": "jalal@gmail.com", 
//     "password":"123456" 
// }