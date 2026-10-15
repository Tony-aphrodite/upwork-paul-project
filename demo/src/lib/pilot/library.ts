import contentJson from "../../../content/pilot/content.json";
import careHomesJson from "../../../content/pilot/care-homes.json";
import contactsJson from "../../../content/pilot/contacts.json";
import { PilotContent } from "./content";
import { CareHomes } from "./care-homes";
import { Contacts } from "./contacts";

/** The live content, validated when loaded so a broken import fails the build rather than a family. */
export const content = PilotContent.parse(contentJson);

/** The client's care home list (npm run care-homes:import), validated the same way. */
export const careHomes = CareHomes.parse(careHomesJson);

/** The client's list of organisations for useful contacts (npm run contacts:import), validated the same way. */
export const contacts = Contacts.parse(contactsJson);

/** Whether real families may use the service with this content (see REQUIRE_APPROVED_CONTENT). */
export const contentBlocked = (require: boolean) => require && content.status !== "approved";
