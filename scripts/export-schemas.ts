// Writes the JSON Schemas for the three contracts to schemas/, for the questionnaire, AI and CRM teams.
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { ActionPlan, FamilyProfile, ModuleDefinition } from "../src/lib/schema";

for (const [name, schema] of [["family-profile", FamilyProfile], ["action-plan", ActionPlan], ["module-definition", ModuleDefinition]] as const) {
  writeFileSync(`schemas/${name}.schema.json`, JSON.stringify({ $id: `https://kinfield.example/schemas/${name}`, ...z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) }, null, 2) + "\n");
  console.log(`schemas/${name}.schema.json`);
}
