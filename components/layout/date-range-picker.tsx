"use client";

import { useDateRange } from "@/lib/hooks/use-date-range";
import { DATE_PRESETS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, isValid, isBefore, isEqual } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function DateRangePicker() {
  const { dateRange, setDateRange } = useDateRange();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Local pending state for the range being selected inside the popover
  const [pendingFrom, setPendingFrom] = useState<Date | undefined>(undefined);
  const [pendingTo, setPendingTo] = useState<Date | undefined>(undefined);
  // Track how many clicks into the current selection we are
  const clickCountRef = useRef(0);

  // Input field values
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  // Sync pending state & inputs when popover opens
  useEffect(() => {
    if (open) {
      const from = dateRange.from ? parseISO(dateRange.from) : undefined;
      const to = dateRange.to ? parseISO(dateRange.to) : undefined;
      setPendingFrom(from);
      setPendingTo(to);
      clickCountRef.current = 0;
      setFromInput(from ? format(from, "yyyy-MM-dd") : "");
      setToInput(to ? format(to, "yyyy-MM-dd") : "");
    }
  }, [open, dateRange.from, dateRange.to]);

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

  const applyRange = () => {
    if (pendingFrom && pendingTo) {
      setDateRange({
        from: format(pendingFrom, "yyyy-MM-dd"),
        to: format(pendingTo, "yyyy-MM-dd"),
      });
      setOpen(false);
    }
  };

  const handleFromInputChange = (value: string) => {
    setFromInput(value);
    const parsed = parseISO(value);
    if (isValid(parsed)) {
      setPendingFrom(parsed);
      if (pendingTo && isBefore(pendingTo, parsed)) {
        setPendingTo(parsed);
        setToInput(value);
      }
    }
  };

  const handleToInputChange = (value: string) => {
    setToInput(value);
    const parsed = parseISO(value);
    if (isValid(parsed)) {
      if (pendingFrom && isBefore(parsed, pendingFrom)) {
        setPendingTo(pendingFrom);
        setToInput(format(pendingFrom, "yyyy-MM-dd"));
      } else {
        setPendingTo(parsed);
      }
    }
  };

  const calendarSelected =
    pendingFrom
      ? { from: pendingFrom, to: pendingTo }
      : undefined;

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
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <div className="flex flex-1 items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Start</label>
              <input
                type="date"
                value={fromInput}
                onChange={(e) => handleFromInputChange(e.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground">–</span>
            <div className="flex flex-1 items-center gap-1.5">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">End</label>
              <input
                type="date"
                value={toInput}
                onChange={(e) => handleToInputChange(e.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <Calendar
            mode="range"
            selected={calendarSelected}
            onSelect={(range) => {
              clickCountRef.current += 1;
              const isSecondClick = clickCountRef.current >= 2;

              if (range?.from && range?.to && isSecondClick) {
                // Second click completed the range
                const from = isBefore(range.from, range.to) || isEqual(range.from, range.to) ? range.from : range.to;
                const to = isBefore(range.from, range.to) || isEqual(range.from, range.to) ? range.to : range.from;
                setPendingFrom(from);
                setPendingTo(to);
                setFromInput(format(from, "yyyy-MM-dd"));
                setToInput(format(to, "yyyy-MM-dd"));
                // Auto-apply on second click
                setDateRange({
                  from: format(from, "yyyy-MM-dd"),
                  to: format(to, "yyyy-MM-dd"),
                });
                setOpen(false);
                clickCountRef.current = 0;
              } else if (range?.from) {
                // First click — set start date, clear end date
                setPendingFrom(range.from);
                setPendingTo(undefined);
                setFromInput(format(range.from, "yyyy-MM-dd"));
                setToInput("");
                clickCountRef.current = 1;
              }
            }}
            numberOfMonths={isMobile ? 1 : 2}
          />
          <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!pendingFrom || !pendingTo}
              onClick={applyRange}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
