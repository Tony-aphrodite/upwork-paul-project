import type { Metadata } from "next";
import { FamilyShell } from "@/components/FamilyShell";
import { content } from "@/lib/pilot/library";
import { StartFlow } from "./StartFlow";

export const metadata: Metadata = { title: "Family Ageing Questionnaire" };

export default function StartPage() {
  const t = content.texts;
  return (
    <FamilyShell>
      <StartFlow
        doc={content.questionnaire}
        texts={{ consent: t.consent, consentCheckbox: t.consent_checkbox, marketing: t.marketing_consent ?? "", thankYou: t.thank_you, contactIntro: t.contact_intro ?? "" }}
        draft={content.status === "draft"}
      />
    </FamilyShell>
  );
}
