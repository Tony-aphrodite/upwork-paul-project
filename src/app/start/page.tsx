import type { Metadata } from "next";
import { FamilyShell } from "@/components/FamilyShell";
import { content } from "@/lib/pilot/library";
import { StartFlow } from "./StartFlow";

export const metadata: Metadata = { title: "Family Ageing Questionnaire" };

export default function StartPage() {
  const t = content.texts;
  return (
    <FamilyShell notice={t.notice}>
      <StartFlow
        doc={content.questionnaire}
        texts={{ consent: t.consent, marketing: t.marketing_consent ?? "", thankYou: t.thank_you, notice: t.notice }}
        draft={content.status === "draft"}
      />
    </FamilyShell>
  );
}
