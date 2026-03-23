import { Router } from "express";
import { getConversations, getMessages, deleteConversation } from "../controllers/conversationController";


const router = Router();

router.get("/", getConversations);
router.delete("/:conversationId", deleteConversation);
router.get("/:conversationId/messages", getMessages);


export default router;
