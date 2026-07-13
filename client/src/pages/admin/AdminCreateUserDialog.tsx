import { useState, type FormEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/cafe/context/LanguageContext";
import { createAdminUser } from "@/lib/adminUsersClient";
import { toast } from "sonner";
import type { PaystackPlanId } from "@shared/planCatalog";
import { adminOutlineBtnClass, adminPanelCardClass } from "./adminUserUi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (uid: string) => void;
};

export function AdminCreateUserDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [planId, setPlanId] = useState<PaystackPlanId | "none">("none");
  const [emailVerified, setEmailVerified] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [planTestMode, setPlanTestMode] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setDisplayName("");
    setPassword("");
    setPlanId("none");
    setEmailVerified(false);
    setDisabled(false);
    setPlanTestMode(false);
  };

  const planLabel = (id: PaystackPlanId) => {
    if (id === "starter") return t("planStarterName");
    if (id === "business") return t("planBusinessName");
    if (id === "unlimited") return t("planUnlimitedName");
    if (id === "enterprise") return t("planEnterpriseName");
    return id;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await createAdminUser({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
        emailVerified,
        disabled,
        planId: planId === "none" ? null : planId,
        planTestMode,
      });
      toast.success(result.message);
      reset();
      onOpenChange(false);
      onCreated(result.uid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <UserPlus className="size-5 text-brand-red" />
            {t("adminCreateUserTitle")}
          </DialogTitle>
          <DialogDescription>{t("adminCreateUserDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className={`${adminPanelCardClass} space-y-4`}>
          <div className="space-y-2">
            <Label htmlFor="create-email" className="font-display text-xs">
              {t("adminUsersColEmail")} *
            </Label>
            <Input
              id="create-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-name" className="font-display text-xs">
              {t("adminUserDisplayName")}
            </Label>
            <Input
              id="create-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-password" className="font-display text-xs">
              {t("authPasswordLabel")} *
            </Label>
            <Input
              id="create-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-display text-xs">{t("adminUsersColPlan")}</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v as PaystackPlanId | "none")}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground border-border">
                <SelectItem value="none">{t("adminUserNoPlan")}</SelectItem>
                {(["starter", "business", "unlimited", "enterprise"] as const).map((id) => (
                  <SelectItem key={id} value={id}>
                    {planLabel(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={emailVerified} onChange={(e) => setEmailVerified(e.target.checked)} />
            {t("adminUserMarkVerified")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />
            {t("adminUserCreateDisabled")}
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={planTestMode} onChange={(e) => setPlanTestMode(e.target.checked)} />
            {t("adminUsersTestMode")}
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className={adminOutlineBtnClass} onClick={() => onOpenChange(false)}>
              {t("adminUserCancel")}
            </Button>
            <Button type="submit" className="flex-1 font-display bg-brand-red text-white hover:bg-brand-red/90" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : t("adminCreateUserSubmit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
