import questionnaireJson from "../../../content/questionnaire.json";
import { Questionnaire } from "./schema";

/**
 * The live questionnaire, validated when loaded so a broken edit fails at build time rather than in front of a family.
 * In production this comes from the content repository with the same shape, one record per version.
 */
export const questionnaire = Questionnaire.parse(questionnaireJson);
export const QUESTIONNAIRE_VERSION = questionnaire.version;
