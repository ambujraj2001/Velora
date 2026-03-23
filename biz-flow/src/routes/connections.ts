import { Router } from "express";
import { addConnection, getConnections, deleteConnection } from "../controllers/connectionController";

const router = Router();

router.post("/", addConnection);
router.get("/", getConnections);
router.delete("/:id", deleteConnection);

export default router;
