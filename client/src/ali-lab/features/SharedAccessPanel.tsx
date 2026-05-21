import { useEffect, useState } from "react";
import type { AliLabFeature } from "../featureRegistry";
import { useLabLanguage } from "../context/LabLanguageContext";
import type { LabMember } from "../types";
import { useAuth } from "@/cafe/context/AuthContext";

export function SharedAccessPanel({ feature }: { feature: AliLabFeature }) {
  const { t } = useLabLanguage();
  const { user } = useAuth();
  const key = `ali-lab-members-${user?.uid || "anon"}`;
  const [members, setMembers] = useState<LabMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<LabMember["role"]>("editor");

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "[]");
      setMembers(Array.isArray(raw) && raw.length ? raw : [{ id: "1", email: user?.email || "owner@lab", role: "owner" }]);
    } catch {
      setMembers([{ id: "1", email: user?.email || "owner@lab", role: "owner" }]);
    }
  }, [key, user?.email]);

  const save = (next: LabMember[]) => {
    setMembers(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{feature.summary}</p>
      <p className="text-xs rounded border border-amber-500/30 bg-amber-500/5 p-3">
        Prototype only — production needs Firestore <code>workspaces</code> + invites (see super prompt). FairSplit
        settlement mock below.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          className="border border-border rounded px-2 py-1 flex-1"
          placeholder={t("inviteEmail")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select className="border border-border rounded px-2 py-1 text-xs" value={role} onChange={(e) => setRole(e.target.value as LabMember["role"])}>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
          <option value="accountant">Accountant</option>
        </select>
        <button
          type="button"
          className="bg-brand-red text-white text-xs font-bold uppercase px-3 py-1 rounded"
          onClick={() => {
            if (!email.trim()) return;
            save([...members, { id: crypto.randomUUID(), email: email.trim(), role }]);
            setEmail("");
          }}
        >
          Invite (mock)
        </button>
      </div>
      <ul className="text-sm space-y-1">
        {members.map((m) => (
          <li key={m.id} className="flex justify-between border border-border rounded px-2 py-1">
            <span>{m.email}</span>
            <span className="uppercase text-[10px] font-bold">{m.role}</span>
          </li>
        ))}
      </ul>
      <div className="border border-border rounded p-3 text-xs">
        <p className="font-bold uppercase mb-1">FairSplit demo</p>
        <p>Alice paid 120 CHF · Bob owes 60 CHF · settled: pending</p>
      </div>
    </div>
  );
}
