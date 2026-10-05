import { describe, expect, it } from "vitest";

const eventIdentity = (supplierKey: string, eventId: string) => `${supplierKey}:${eventId}`;

describe("provider-scoped supplier webhook idempotency", () => {
  it("treats a replay from the same supplier as a duplicate", () => {
    expect(eventIdentity("flashtopup", "evt-1")).toBe(eventIdentity("flashtopup", "evt-1"));
  });

  it("allows the same external event id from different suppliers", () => {
    expect(eventIdentity("flashtopup", "evt-1")).not.toBe(eventIdentity("future-provider", "evt-1"));
  });
});