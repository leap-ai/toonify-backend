import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import {
	type NextFunction,
	type Request,
	type Response,
	Router,
} from "express";
import auth from "../auth";
import { db } from "../db";
import { user } from "../db/schema";

const router = Router();

// Get user's credit balance
const getBalance = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});

		if (!session?.user?.id) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const userVal = await db.query.user.findFirst({
			where: eq(user.id, session.user.id),
			columns: {
				creditsBalance: true,
			},
		});

		res.json({ creditsBalance: userVal?.creditsBalance || 0 });
	} catch (error) {
		next(error);
	}
};

router.get("/balance", getBalance);

export default router;
