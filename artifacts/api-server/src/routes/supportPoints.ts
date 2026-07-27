import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, supportPointsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/pontos-apoio", async (req, res): Promise<void> => {
  const praca = (req.query.praca as string) || "Chapecó";

  const pontos = await db
    .select()
    .from(supportPointsTable)
    .where(and(eq(supportPointsTable.praca, praca), eq(supportPointsTable.ativo, "true")));

  res.json(pontos);
});

export default router;
