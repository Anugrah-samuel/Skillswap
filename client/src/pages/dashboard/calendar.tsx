import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, User, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Calendar() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: "",
    partner: "",
    skill: "",
    date: "",
    time: "",
    duration: "",
    description: "",
  });

  const [events, setEvents] = useState<any[]>([]);

  const openDialog = (event?: any) => {
    if (event) {
      setSelectedEvent(event);
      setFormData(event);
    } else {
      setSelectedEvent(null);
      setFormData({
        title: "",
        partner: "",
        skill: "",
        date: "",
        time: "",
        duration: "",
        description: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (selectedEvent) {
      setEvents(events.map(e => e.id === selectedEvent.id ? { ...formData, id: selectedEvent.id, status: selectedEvent.status } : e));
      toast({ title: "Event updated successfully" });
    } else {
      setEvents([...events, { ...formData, id: Date.now().toString(), status: "upcoming" }]);
      toast({ title: "Event created successfully" });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
    toast({ title: "Event deleted" });
  };

  const upcomingEvents = events.filter(e => e.status === "upcoming").sort((a, b) => 
    new Date(a.date + ' ' + a.time).getTime() - new Date(b.date + ' ' + b.time).getTime()
  );

  const completedEvents = events.filter(e => e.status === "completed");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">Calendar</h1>
          <p className="text-muted-foreground text-lg">
            Manage your skill exchange sessions
          </p>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Schedule Session
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>Your scheduled skill exchange sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="mb-4">No upcoming sessions scheduled</p>
                  <Button onClick={() => openDialog()} data-testid="button-schedule-first">
                    Schedule Your First Session
                  </Button>
                </div>
              ) : (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border border-card-border hover-elevate transition-all"
                    data-testid={`event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>with {event.partner}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{formatDate(event.date)} at {event.time} ({event.duration})</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
                      </div>
                      <Badge variant="outline">{event.skill}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(event)}
                        data-testid={`button-edit-${event.id}`}
                      >
                        <Edit className="h-3 w-3 mr-2" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(event.id)}
                        data-testid={`button-delete-${event.id}`}
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {completedEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Sessions</CardTitle>
                <CardDescription>Your completed skill exchanges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg bg-muted/50"
                    data-testid={`completed-event-${event.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium mb-1">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.date)} with {event.partner}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">{event.skill}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold mb-1">{upcomingEvents.length}</p>
                <p className="text-sm text-muted-foreground">Upcoming Sessions</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{completedEvents.length}</p>
                <p className="text-sm text-muted-foreground">Completed Exchanges</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{events.length}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? "Edit Session" : "Schedule New Session"}</DialogTitle>
            <DialogDescription>
              {selectedEvent ? "Update the details of your skill exchange session" : "Create a new skill exchange session"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                placeholder="Session Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-event-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner">Partner</Label>
                <Input
                  id="partner"
                  placeholder="Partner name"
                  value={formData.partner}
                  onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                  data-testid="input-event-partner"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill">Skill</Label>
                <Input
                  id="skill"
                  placeholder="Skill to exchange"
                  value={formData.skill}
                  onChange={(e) => setFormData({ ...formData, skill: e.target.value })}
                  data-testid="input-event-skill"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-event-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  placeholder="Duration"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  data-testid="input-event-duration"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add session details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-event-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-event">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-event">
              {selectedEvent ? "Update Session" : "Create Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
