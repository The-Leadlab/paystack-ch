import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Input>, "type"> & {
  revealLabel?: string;
  hideLabel?: string;
};

export function PasswordField({
  className,
  revealLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? hideLabel : revealLabel}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
