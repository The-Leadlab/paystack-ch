import type { TourRect } from "./useProductTour";
import type { TourStep } from "./tourSteps";

type Props = {
  step: TourStep;
  index: number;
  total: number;
  rect: TourRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const PAD = 8;

export function ProductTourOverlay({
  step,
  index,
  total,
  rect,
  onNext,
  onBack,
  onSkip,
}: Props) {
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const popoverStyle = (() => {
    if (!hole) {
      return { top: "30%", left: "50%", transform: "translateX(-50%)" } as const;
    }
    const below = hole.top + hole.height + 12;
    const spaceBelow = window.innerHeight - below;
    const top = spaceBelow > 180 ? below : Math.max(12, hole.top - 160);
    const left = Math.min(
      Math.max(12, hole.left),
      Math.max(12, window.innerWidth - 320)
    );
    return { top, left };
  })();

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute inset-0 bg-black/55" onClick={onSkip} />
      {hole ? (
        <div
          className="absolute rounded-xl ring-2 ring-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      ) : null}
      <div
        className="absolute z-[91] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl bg-[#12151c] text-white border border-white/15 p-4 shadow-xl"
        style={popoverStyle}
      >
        <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1">
          {index + 1} / {total}
        </p>
        <h2 className="text-sm font-bold">{step.title}</h2>
        <p className="mt-1.5 text-xs text-white/65 leading-relaxed">{step.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNext}
            className="h-9 px-4 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90"
          >
            {index >= total - 1 ? "Done" : "Next"}
          </button>
          {index > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-3 text-xs font-semibold text-white/70 hover:text-white"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSkip}
            className="h-9 px-3 ml-auto text-xs font-semibold text-white/55 hover:text-white"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
