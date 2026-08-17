import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** top-center default only allows vertical swipe; enable all dismiss directions */
const SWIPE_DIRECTIONS = ["top", "bottom", "left", "right"] as const;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      swipeDirections={[...SWIPE_DIRECTIONS]}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:cursor-grab active:cursor-grabbing group-[.toaster]:touch-pan-x group-[.toaster]:touch-pan-y",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:cursor-pointer",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
