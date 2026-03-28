import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, compsTable, dealCompsTable, dealsTable } from "@workspace/db";
import {
  GetDealCompsParams,
  AddCompToDealParams,
  AddCompToDealBody,
  UpdateDealCompParams,
  UpdateDealCompBody,
  RemoveDealCompParams,
  CreateCompBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/deals/:id/comps", async (req, res): Promise<void> => {
  const params = GetDealCompsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const dealComps = await db
    .select()
    .from(dealCompsTable)
    .where(eq(dealCompsTable.dealId, params.data.id));

  const compIds = dealComps.map((dc) => dc.compId);
  const compsData =
    compIds.length > 0
      ? (await db.select().from(compsTable)).filter((c) => compIds.includes(c.id))
      : [];

  const compMap = new Map(compsData.map((c) => [c.id, c]));

  const result = dealComps
    .map((dc) => ({ ...dc, comp: compMap.get(dc.compId)! }))
    .filter((dc) => dc.comp);

  res.json(result);
});

router.post("/deals/:id/comps", async (req, res): Promise<void> => {
  const params = AddCompToDealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddCompToDealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [deal] = await db.select().from(dealsTable).where(eq(dealsTable.id, params.data.id));
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  let compId = parsed.data.compId;

  if (!compId && parsed.data.newComp) {
    const [newComp] = await db
      .insert(compsTable)
      .values({
        address: parsed.data.newComp.address,
        salePrice: parsed.data.newComp.salePrice ?? null,
        listPrice: parsed.data.newComp.listPrice ?? null,
        sqft: parsed.data.newComp.sqft ?? null,
        lotSize: parsed.data.newComp.lotSize ?? null,
        beds: parsed.data.newComp.beds ?? null,
        baths: parsed.data.newComp.baths ?? null,
        distanceMiles: parsed.data.newComp.distanceMiles ?? null,
        soldDate: parsed.data.newComp.soldDate ?? null,
        listingStatus: parsed.data.newComp.listingStatus,
        propertyType: parsed.data.newComp.propertyType,
        condition: parsed.data.newComp.condition,
        source: parsed.data.newComp.source,
        latitude: parsed.data.newComp.latitude ?? null,
        longitude: parsed.data.newComp.longitude ?? null,
        dataSource: "manual",
      })
      .returning();
    compId = newComp.id;
  }

  if (!compId) {
    res.status(400).json({ error: "Must provide compId or newComp" });
    return;
  }

  const [dealComp] = await db
    .insert(dealCompsTable)
    .values({
      dealId: params.data.id,
      compId,
      included: parsed.data.included ?? true,
      relevance: parsed.data.relevance ?? "normal",
      notes: parsed.data.notes ?? null,
    })
    .returning();

  const [comp] = await db.select().from(compsTable).where(eq(compsTable.id, compId));

  res.status(201).json({ ...dealComp, comp });
});

router.patch("/deals/:id/comps/:compId", async (req, res): Promise<void> => {
  const params = UpdateDealCompParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDealCompBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const dealCompUpdate: Record<string, unknown> = {};
  if (parsed.data.included !== undefined && parsed.data.included !== null) {
    dealCompUpdate.included = parsed.data.included;
  }
  if (parsed.data.relevance !== undefined && parsed.data.relevance !== null) {
    dealCompUpdate.relevance = parsed.data.relevance;
  }
  if (parsed.data.notes !== undefined) {
    dealCompUpdate.notes = parsed.data.notes;
  }

  // Only update dealCompsTable if there's something to change there
  let dealComp;
  if (Object.keys(dealCompUpdate).length > 0) {
    [dealComp] = await db
      .update(dealCompsTable)
      .set(dealCompUpdate as any)
      .where(
        and(
          eq(dealCompsTable.dealId, params.data.id),
          eq(dealCompsTable.compId, params.data.compId)
        )
      )
      .returning();
  } else {
    [dealComp] = await db
      .select()
      .from(dealCompsTable)
      .where(
        and(
          eq(dealCompsTable.dealId, params.data.id),
          eq(dealCompsTable.compId, params.data.compId)
        )
      );
  }

  if (!dealComp) {
    res.status(404).json({ error: "DealComp not found" });
    return;
  }

  // condition lives on the comp record itself, update it separately
  let comp;
  if (parsed.data.condition !== undefined && parsed.data.condition !== null) {
    [comp] = await db
      .update(compsTable)
      .set({ condition: parsed.data.condition })
      .where(eq(compsTable.id, dealComp.compId))
      .returning();
  } else {
    [comp] = await db.select().from(compsTable).where(eq(compsTable.id, dealComp.compId));
  }

  res.json({ ...dealComp, comp });
});

router.delete("/deals/:id/comps/:compId", async (req, res): Promise<void> => {
  const params = RemoveDealCompParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(dealCompsTable)
    .where(
      and(
        eq(dealCompsTable.dealId, params.data.id),
        eq(dealCompsTable.compId, params.data.compId)
      )
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "DealComp not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/comps", async (req, res): Promise<void> => {
  const parsed = CreateCompBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [comp] = await db
    .insert(compsTable)
    .values({
      address: parsed.data.address,
      salePrice: parsed.data.salePrice ?? null,
      listPrice: parsed.data.listPrice ?? null,
      sqft: parsed.data.sqft ?? null,
      lotSize: parsed.data.lotSize ?? null,
      beds: parsed.data.beds ?? null,
      baths: parsed.data.baths ?? null,
      distanceMiles: parsed.data.distanceMiles ?? null,
      soldDate: parsed.data.soldDate ?? null,
      listingStatus: parsed.data.listingStatus,
      propertyType: parsed.data.propertyType,
      condition: parsed.data.condition,
      source: parsed.data.source,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      dataSource: "manual",
    })
    .returning();

  res.status(201).json(comp);
});

export default router;
