"use client";

import { useDateRange } from "@/lib/hooks/use-date-range";
import { DATE_PRESETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function DateRangePicker() {
  const { dateRange, setDateRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const displayText =
    dateRange.from && dateRange.to
      ? `${format(parseISO(dateRange.from), "MMM d")} - ${format(parseISO(dateRange.to), "MMM d, yyyy")}`
      : "Select dates";
  const activePresetLabel = DATE_PRESETS.find((preset) => {
    const value = preset.getValue();
    return value.from === dateRange.from && value.to === dateRange.to;
  })?.label;
  const isCustomRangeSelected =
    !!dateRange.from && !!dateRange.to && !activePresetLabel;

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      <div className="inline-flex shrink-0 items-center rounded-lg bg-muted p-[3px]">
        {DATE_PRESETS.map((preset) => {
          const isActive = activePresetLabel === preset.label;

          return (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 shrink-0 rounded-md px-2 text-xs font-medium text-muted-foreground shadow-none sm:px-3",
                "hover:text-foreground",
                isActive && "bg-background text-foreground shadow-sm hover:bg-background"
              )}
              onClick={() => {
                setDateRange(preset.getValue());
                setOpen(false);
              }}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-xs font-medium shadow-xs transition-colors sm:px-3",
            "hover:bg-accent hover:text-accent-foreground",
            isCustomRangeSelected &&
              "border-transparent bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:text-white dark:bg-primary-400 dark:text-white dark:hover:bg-primary-300"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          <span className="hidden xs:inline sm:inline">{displayText}</span>
          <span className="xs:hidden sm:hidden">Custom</span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={
              dateRange.from
                ? {
                    from: parseISO(dateRange.from),
                    to: parseISO(dateRange.to),
                  }
                : undefined
            }
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({
                  from: format(range.from, "yyyy-MM-dd"),
                  to: format(range.to, "yyyy-MM-dd"),
                });
                setOpen(false);
              } else if (range?.from) {
                setDateRange({
                  from: format(range.from, "yyyy-MM-dd"),
                  to: format(range.from, "yyyy-MM-dd"),
                });
              }
            }}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
