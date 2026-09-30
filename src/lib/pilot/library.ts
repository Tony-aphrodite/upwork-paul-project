import contentJson from "../../../content/pilot/content.json";
import { PilotContent } from "./content";

/** The live content, validated when loaded so a broken import fails the build rather than a family. */
export const content = PilotContent.parse(contentJson);
