"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock, MapPin, Loader2 } from "lucide-react";
import { PermissionGate } from "@/components/rbac/permission-gate";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  type: string;
  status: string;
  contact_id: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  consultation: "bg-blue-500",
  follow_up: "bg-purple-500",
  internal: "bg-gray-400",
};

const TYPE_DOT: Record<string, string> = {
  consultation: "bg-blue-500",
  follow_up: "bg-purple-500",
  internal: "bg-gray-400",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function CalendarView({ subaccountId }: { subaccountId: string }) {
  const supabase = createClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);

  // Event form
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState("");
  const [evTitle, setEvTitle] = useState("");
  const [evType, setEvType] = useState("internal");
  const [evStartTime, setEvStartTime] = useState("09:00");
  const [evEndTime, setEvEndTime] = useState("09:30");
  const [evLocation, setEvLocation] = useState("");
  const [evDescription, setEvDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Load events for current month
  const loadEvents = useCallback(async () => {
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const { data } = await supabase
      .from("calendar_events")
      .select("id, title, description, start_time, end_time, location, type, status, contact_id")
      .eq("subaccount_id", subaccountId)
      .gte("start_time", startOfMonth)
      .lte("start_time", endOfMonth)
      .order("start_time", { ascending: true });

    setEvents((data || []) as CalendarEvent[]);
    setLoading(false);
  }, [currentDate, subaccountId, supabase]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  function getEventsForDay(day: Date): CalendarEvent[] {
    return events.filter((e) => {
      const evDate = new Date(e.start_time);
      return (
        evDate.getDate() === day.getDate() &&
        evDate.getMonth() === day.getMonth() &&
        evDate.getFullYear() === day.getFullYear()
      );
    });
  }

  function prevMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }
  function goToday() {
    setCurrentDate(new Date());
  }

  // Build calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

  function openCreateForDay(day: Date) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    setCreateDate(dateStr);
    setShowCreate(true);
  }

  function selectDay(day: Date) {
    const dayEvents = getEventsForDay(day);
    setSelectedDate(day);
    setSelectedEvents(dayEvents);
  }

  async function createEvent() {
    if (!evTitle.trim() || !createDate) return;
    setCreating(true);

    const startTimeISO = new Date(`${createDate}T${evStartTime}:00`).toISOString();
    const endTimeISO = new Date(`${createDate}T${evEndTime}:00`).toISOString();

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        subaccount_id: subaccountId,
        title: evTitle,
        description: evDescription || null,
        start_time: startTimeISO,
        end_time: endTimeISO,
        location: evLocation || null,
        type: evType,
        status: "scheduled",
        assigned_to: userData.user?.id,
      })
      .select("id, title, description, start_time, end_time, location, type, status, contact_id")
      .single();

    if (!error && data) {
      setEvents((prev) => [...prev, data as CalendarEvent].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
      setShowCreate(false);
      setEvTitle("");
      setEvLocation("");
      setEvDescription("");
      setEvType("internal");
      // Refresh selected day
      if (selectedDate) {
        const newDayEvents = getEventsForDay(selectedDate);
        setSelectedEvents([...newDayEvents, data as CalendarEvent]);
      }
    }
    setCreating(false);
  }

  async function deleteEvent(id: string) {
    await supabase.from("calendar_events").delete().eq("id", id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Calendar grid */}
      <div className="flex-1">
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="min-h-[80px] rounded-md" />;
            const dayEvents = getEventsForDay(day);
            const isToday =
              day.getDate() === today.getDate() &&
              day.getMonth() === today.getMonth() &&
              day.getFullYear() === today.getFullYear();
            const isSelected =
              selectedDate &&
              day.getDate() === selectedDate.getDate() &&
              day.getMonth() === selectedDate.getMonth();

            return (
              <button
                key={`day-${i}`}
                onClick={() => selectDay(day)}
                onDoubleClick={() => openCreateForDay(day)}
                className={`min-h-[80px] rounded-md border p-1 text-left transition-colors hover:bg-muted/50 ${
                  isToday ? "border-primary" : "border-border"
                } ${isSelected ? "bg-muted/70" : ""}`}
              >
                <div className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {day.getDate()}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] truncate ${TYPE_COLORS[e.type] || "bg-gray-400"} text-white`}
                    >
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          💡 Click a day to see events • Double-click to create
        </p>
      </div>

      {/* Day detail sidebar */}
      <div className="lg:w-80 shrink-0">
        {selectedDate ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedDate.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <PermissionGate subaccountId={subaccountId} require="calendar.manage">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreateForDay(selectedDate)}
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </PermissionGate>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No events scheduled.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <div key={e.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${TYPE_DOT[e.type] || "bg-gray-400"}`} />
                        <p className="font-medium text-sm">{e.title}</p>
                      </div>
                      <PermissionGate subaccountId={subaccountId} require="calendar.manage">
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </PermissionGate>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtTime(e.start_time)} – {fmtTime(e.end_time)}
                      </span>
                      {e.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </span>
                      )}
                    </div>
                    {e.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Select a day to view events</p>
          </div>
        )}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              {createDate && new Date(createDate).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Patient consultation"
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <Label>Start</Label>
                <Input type="time" value={evStartTime} onChange={(e) => setEvStartTime(e.target.value)} />
              </div>
              <div className="space-y-2 flex-1">
                <Label>End</Label>
                <Input type="time" value={evEndTime} onChange={(e) => setEvEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={evType} onValueChange={(v: string | null) => v && setEvType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="e.g. Clinic Room 1, Zoom"
                value={evLocation}
                onChange={(e) => setEvLocation(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional description"
                value={evDescription}
                onChange={(e) => setEvDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createEvent} disabled={creating || !evTitle.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
