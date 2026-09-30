import { z } from "zod";

/** How soon an action matters. Shown in words as well as colour, so it survives black-and-white printing. */
export const PRIORITIES = ["now", "soon", "plan_ahead"] as const;
export const Priority = z.enum(PRIORITIES);
export type Priority = z.infer<typeof Priority>;
export const PRIORITY_LABEL: Record<Priority, string> = { now: "Now", soon: "Soon", plan_ahead: "Plan ahead" };
export const priorityRank = (p: Priority) => PRIORITIES.indexOf(p);
