import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../server/app.js";
import { prisma } from "../server/db.js";

describe("InboxIQ API", () => {
  it("returns exactly the four seed messages as raw Message objects", async () => {
    const response = await request(app).get("/api/messages");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
    expect(response.body.map((message: { id: string }) => message.id)).toEqual([
      "message-perfect",
      "message-partial",
      "message-failure",
      "message-empty",
    ]);
    expect(response.body[0]).toEqual(expect.objectContaining({ company: "Acme", createdAt: expect.any(String) }));
    expect(response.body[0]).not.toHaveProperty("tags");
  });

  it("returns a raw message detail and no list alias", async () => {
    const detail = await request(app).get("/api/messages/message-perfect");
    const alias = await request(app).get("/api/messages/list");

    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe("message-perfect");
    expect(detail.body).not.toHaveProperty("message");
    expect(alias.status).toBe(404);
  });

  it("starts with no leads", async () => {
    const leads = await request(app).get("/api/leads");

    expect(leads.status).toBe(200);
    expect(leads.body).toEqual([]);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("creates a valid lead with NEW status", async () => {
    const response = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("NEW");

    const savedLead = await prisma.lead.findUnique({
      where: { id: response.body.id },
    });

    expect(savedLead).not.toBeNull();
    expect(savedLead).toEqual(
      expect.objectContaining({
        product: "Desk",
        status: "NEW",
      })
    );

  });

  it("updates a NEW lead status to CONTACTED", async () => {
    const response = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000
      });

    const response2 = await request(app)
      .patch(`/api/leads/${response.body.id}/status`)
      .send({
        status: "CONTACTED"
      });

    expect(response2.status).toBe(200);
    expect(response2.body.status).toBe("CONTACTED");
    
    const savedLead = await prisma.lead.findUnique({
      where: { id: response.body.id },
    });

    expect(savedLead).toEqual(
      expect.objectContaining({
        status: "CONTACTED",
      })
    );
  });
  
it("returns 404 when updating a missing lead", async () => {
  const response = await request(app)
    .patch("/api/leads/non-existing-lead/status")
    .send({
      status: "CONTACTED",
    });

  expect(response.status).toBe(404);
  expect(response.body.error).toBe("lead_not_found");
});

it("rejects updating an already CONTACTED lead", async () => {
  const createdLead = await request(app)
    .post("/api/leads")
    .send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 30,
      material: "Oak",
      budget: 50000,
    });

  const firstUpdate = await request(app)
    .patch(`/api/leads/${createdLead.body.id}/status`)
    .send({
      status: "CONTACTED",
    });

  expect(firstUpdate.status).toBe(200);
  expect(firstUpdate.body.status).toBe("CONTACTED");

  const secondUpdate = await request(app)
    .patch(`/api/leads/${createdLead.body.id}/status`)
    .send({
      status: "CONTACTED",
    });

  expect(secondUpdate.status).toBe(409);
  expect(secondUpdate.body.error).toBe("invalid_status_transition");
});

  it("rejects invalid lead data without creating a record", async () => {
    const beforeCount = await prisma.lead.count();
    const response = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: -5,
        material: "Oak",
        budget: 50000
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("invalid_request");

      const afterCount = await prisma.lead.count();
      expect(afterCount).toBe(beforeCount);
  });

  it("rejects a lead for a missing source message", async () => {
    const beforeCount = await prisma.lead.count();
    const response = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-does-not-exist",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("message_not_found");

      const afterCount = await prisma.lead.count();
      expect(afterCount).toBe(beforeCount);
  });

  it("rejects an unsupported lead status", async () => {
    const createdLead = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000,
      });

    const response = await request(app)
      .patch(`/api/leads/${createdLead.body.id}/status`)
      .send({
        status: "NEW",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");
  });
  
  it("rejects extra fields when updating lead status", async () => {
    const createdLead = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000,
      });

    const response = await request(app)
      .patch(`/api/leads/${createdLead.body.id}/status`)
      .send({
        status: "CONTACTED",
        extra: "not-allowed",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");
  });

  it("ignores client-provided status when creating a lead", async () => {
    const response = await request(app)
      .post("/api/leads")
      .send({
        sourceMessageId: "message-perfect",
        product: "Desk",
        quantity: 30,
        material: "Oak",
        budget: 50000,
        status: "CONTACTED"
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("NEW");
  });

  it("returns a stable error for malformed API JSON", async () => {
    const response = await request(app)
      .post("/api/ai/extract")
      .set("content-type", "application/json")
      .send('{"messageId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_json" });
  });

  it("accepts only the strict messageId extraction request", async () => {
    const alias = await request(app).post("/api/ai/extract").send({ id: "message-perfect" });
    const perfect = await request(app).post("/api/ai/extract").send({ messageId: "message-perfect" });

    expect(alias.status).toBe(400);
    expect(perfect.status).toBe(200);
    expect(perfect.body).toEqual({ product: "Desk", quantity: 30, material: "Oak", budget: 50000 });
  });

  it("returns deterministic partial, failure, and empty extraction states", async () => {
    const partial = await request(app).post("/api/ai/extract").send({ messageId: "message-partial" });
    const failure = await request(app).post("/api/ai/extract").send({ messageId: "message-failure" });
    const empty = await request(app).post("/api/ai/extract").send({ messageId: "message-empty" });

    expect(partial.status).toBe(200);
    expect(partial.body).toEqual({ product: "Ergonomic Chair", quantity: null, material: "Black", budget: 12000 });
    expect(failure.status).toBe(500);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({});
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
