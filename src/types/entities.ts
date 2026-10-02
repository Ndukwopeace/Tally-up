/**
 * Shapes of the records the app works with (ARCHITECTURE §3.2 `types/entities.ts`).
 *
 * WHY:  One definition per record, shared by pages, hooks and services, so the
 *       screens and the data layer cannot disagree on a field name.
 * HOW:  Plain TypeScript interfaces in camelCase. Services convert database
 *       rows (snake_case) into these.
 * WHEN: Imported wherever a record is passed around. Grows milestone by milestone.
 * SECURITY: Types only. What a user may read is decided by RLS, not by these types.
 */
import type { RecordStatus, Role } from "./enums";

/** A Tally-Up account: one row of `profiles` (REQUIREMENTS §9 User, USR-02). */
export interface Account {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: RecordStatus;
}
