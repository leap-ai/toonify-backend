import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import express, {
	type NextFunction,
	type Request,
	type Response,
	Router,
} from "express";
import auth from "../auth";
import { db } from "../db";
import { user } from "../db/schema";

const router = Router();

// GET /api/subscription/pro - Fetch current user's subscription status details
const getProStatus: express.RequestHandler = async (req, res, next) => {
	try {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		});

		if (!session?.user?.id) {
			res.status(401).json({ error: "User not authenticated" });
			return;
		}

		const proStatus = await db.query.user.findFirst({
			where: eq(user.id, session.user.id),
			columns: {
				// Select only the relevant fields
				creditsBalance: true,
				isProMember: true,
				proMembershipExpiresAt: true,
				subscriptionInGracePeriod: true,
			}
		});

		if (!proStatus) {
			// This shouldn't happen if user has a session, but handle defensively
			res.status(404).json({ error: "User not found" });
			return;
		}

		res.json(proStatus);

	} catch (error) {
		console.error("Error fetching pro status:", error);
		next(error);
	}
};

// Get user's credit balance
const getBalance: express.RequestHandler = async (req, res, next) => {
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

		if (!userVal) {
			res.status(404).json({ error: "User not found" });
			return;
		}

		res.json({ creditsBalance: userVal.creditsBalance });
	} catch (error) {
		console.error("Error fetching balance:", error);
		next(error);
	}
};

router.get("/pro", getProStatus);
router.get("/balance", getBalance);

export default router;
