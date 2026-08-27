import "dotenv/config";
import express from "express"
import cookieParser from 'cookie-parser'
import cors from 'cors'
import userRoutes from './routes/user.route.js'
import postRouters from './routes/post.route.js'
import pollRouter from './routes/poll.route.js'
import questionRouter from './routes/question.route.js'
import debateRouter from './routes/debate.route.js'
import communityRouter from './routes/community.route.js'
import reputationRouter from './routes/reputation.route.js'
import badgeRouter from './routes/badge.route.js'
import verificationRouter from './routes/verification.route.js'
import creatorRouter from './routes/creator.route.js'
import trendingRouter from './routes/trending.route.js'
import PostsPollsRoute from './routes/posts-polls.route.js'
import personalizedFeedRoute from './routes/personalizedFeed.route.js'
import adminRouter from './routes/admin.route.js'
import reportRouter from './routes/report.route.js'
import aiRouter from './routes/ai.route.js'
import searchRouter from './routes/search.route.js'
import notificationRouter from './routes/notification.route.js'
import messageRouter from './routes/message.route.js'
import topicRouter from './routes/topic.route.js'
import commentRouter from './routes/comment.route.js'
import personalizationRouter from './routes/personalization.route.js'
import database from "./config/db.connect.js"
import { startRepeatingTrendingJob } from './queues/queue.js'
import { app, server } from "./socket/socket.js"
import { modelRegistry } from "./ai/core/modelRegistry.js"
import { initializeBadges } from "./controllers/badge.controller.js"
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
app.use("/question", questionRouter)
app.use("/debate", debateRouter)
app.use("/community", communityRouter)
app.use("/reputation", reputationRouter)
app.use("/badges", badgeRouter)
app.use("/verification", verificationRouter)
app.use("/creator", creatorRouter)
app.use("/trending", trendingRouter)
app.use("/topic", topicRouter)
app.use("/comment", commentRouter)
app.use("/feed", personalizationRouter)
app.use("/feed",PostsPollsRoute)
app.use("/feed",personalizedFeedRoute)
app.use("/admin",adminRouter)
app.use("/report",reportRouter)
app.use("/ai",aiRouter)
app.use("/search",searchRouter)
app.use("/notifications", notificationRouter)
app.use("/message", messageRouter)

server.listen(port, "0.0.0.0", async () => {
    database();
    // Initialize TensorFlow.js ML Models
    await modelRegistry.initializeAllModels();
    // Seed core badge catalog
    await initializeBadges();
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