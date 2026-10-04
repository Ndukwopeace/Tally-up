/**
 * Renders an admin page over the spec's example data, with the clock fixed.
 *
 * WHY:  The monitoring screens (Home, Collections, Distributions and their detail
 *       pages) are tested over the same story, and flags and "Today" labels depend
 *       on the clock.
 * HOW:  `openAdmin` builds the mock services (the example operations, Big Bread,
 *       Akwa and Bonaberi, two distributors) and renders the real routes signed in
 *       as the admin. `fixClock` fakes only `Date`, so timers and promises still run.
 * WHEN: Imported by the monitoring page tests.
 * SECURITY: Test-only; fictional data.
 */
import { afterEach, beforeEach, vi } from "vitest";

import { FIXTURE_NOW, specOperations } from "../fixtures/operations";

import { renderRoutes } from "./renderRoutes";

import { MockDepotService } from "@/services/mock/MockDepotService";
import { MOCK_USERS } from "@/services/mock/MockAuthService";
import { MockOperationsService, type MockOperationsData } from "@/services/mock/MockOperationsService";
import { MockProductService } from "@/services/mock/MockProductService";
import { MockUserService } from "@/services/mock/MockUserService";
import { SPEC_PRODUCT } from "@/services/mock/specOperations";
import type { Depot, User } from "@/types/entities";

const depot = (id: string, name: string): Omit<Depot, "manager"> => ({
  id,
  name,
  location: "Douala",
  address: "Market",
  phones: [],
  status: "active",
});
const distributor = (id: string, fullName: string): User => ({
  id,
  fullName,
  email: `${id}@x.test`,
  phones: [],
  role: "distributor",
  status: "active",
  depot: null,
});

/** Only the clock is faked, so time-based flags are stable while the rest of the test runs normally. */
export function fixClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXTURE_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

export function openAdmin(
  path: string,
  change?: (data: MockOperationsData) => void,
  prepare?: (operations: MockOperationsService) => void,
) {
  const data = specOperations();
  change?.(data);
  const operations = new MockOperationsService(data);
  prepare?.(operations);
  const view = renderRoutes(path, {
    signedInAs: MOCK_USERS.admin.id,
    operations,
    products: new MockProductService([SPEC_PRODUCT]),
    depots: new MockDepotService([depot("akwa", "Akwa"), depot("bonaberi", "Bonaberi")]),
    users: new MockUserService([
      distributor("dist-1", "Dan Distributor"),
      distributor("dist-2", "Dora Distributor"),
    ]),
  });
  return { ...view, operations };
}

/** For `openAdmin`: removes every collection, hand-over and confirmation, so a page shows its empty state. */
export function clearRecords(data: MockOperationsData): void {
  data.collections = [];
  data.collectionItems = [];
  data.distributions = [];
  data.distributionItems = [];
  data.confirmations = [];
  data.confirmationCounts = [];
  data.corrections = [];
}
