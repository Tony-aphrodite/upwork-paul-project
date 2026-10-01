import contentJson from "../../../content/pilot/content.json";
import { PilotContent } from "./content";

/** The live content, validated when loaded so a broken import fails the build rather than a family. */
export const content = PilotContent.parse(contentJson);

/** Whether real families may use the service with this content (see REQUIRE_APPROVED_CONTENT). */
export const contentBlocked = (require: boolean) => require && content.status !== "approved";
