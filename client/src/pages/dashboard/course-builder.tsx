import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, Play, FileText, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mockCourseApi, type Course, type Lesson, type Resource } from "@/lib/mockCourseApi";

const categories = ["Technology", "Design", "Business", "Languages", "Arts", "Fitness", "Music", "Cooking"];
const currencies = ["INR", "credits"];

export default function CourseBuilder() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false);
  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // Course form state
  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    currency: "INR",
    duration: ""
  });

  // Lesson form state
  const [lessonForm, setLessonForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    notes: "",
    isPreview: false
  });

  // Resource form state
  const [resourceForm, setResourceForm] = useState({
    title: "",
    url: "",
    type: "pdf"
  });

  // Load courses on component mount
  useEffect(() => {
    loadCourses();
  }, []);

  // Load courses and related data when selected course changes
  useEffect(() => {
    if (selectedCourse) {
      loadCourseData(selectedCourse.id);
    } else {
      setLessons([]);
      setResources([]);
    }
  }, [selectedCourse]);

  const loadCourses = () => {
    const userCourses = mockCourseApi.getCoursesByInstructor(""); // User ID will be loaded from auth
    setCourses(userCourses);
  };

  const loadCourseData = (courseId: string) => {
    const courseLessons = mockCourseApi.getLessonsByCourse(courseId);
    const courseResources = mockCourseApi.getResourcesByCourse(courseId);
    setLessons(courseLessons);
    setResources(courseResources);
  };

  const handleCreateCourse = () => {
    setCourseForm({
      title: "",
      description: "",
      category: "",
      price: "",
      currency: "INR",
      duration: ""
    });
    setSelectedCourse(null);
    setIsCourseDialogOpen(true);
  };

  const handleEditCourse = (course: Course) => {
    setCourseForm({
      title: course.title,
      description: course.description,
      category: course.category,
      price: course.price.toString(),
      currency: course.currency,
      duration: course.duration
    });
    setSelectedCourse(course);
    setIsCourseDialogOpen(true);
  };

  const handleSaveCourse = () => {
    if (!courseForm.title || !courseForm.description || !courseForm.category || !courseForm.duration) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const courseData = {
      title: courseForm.title,
      description: courseForm.description,
      category: courseForm.category,
      price: parseFloat(courseForm.price) || 0,
      currency: courseForm.currency as "INR" | "credits",
      duration: courseForm.duration,
      instructorId: "", // User ID will be loaded from auth
      instructorName: "", // User name will be loaded from auth
      lessons: [],
      resources: [],
      previewLessonId: null
    };

    if (selectedCourse) {
      // Update existing course
      const updated = mockCourseApi.updateCourse(selectedCourse.id, courseData);
      if (updated) {
        toast({ title: "Course updated successfully" });
        loadCourses();
        setIsCourseDialogOpen(false);
      } else {
        toast({ title: "Failed to update course", variant: "destructive" });
      }
    } else {
      // Create new course
      const newCourse = mockCourseApi.createCourse(courseData);
      toast({ title: "Course created successfully" });
      loadCourses();
      setSelectedCourse(newCourse);
      setIsCourseDialogOpen(false);
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    if (confirm("Are you sure you want to delete this course? This action cannot be undone.")) {
      const deleted = mockCourseApi.deleteCourse(courseId);
      if (deleted) {
        toast({ title: "Course deleted successfully" });
        loadCourses();
        if (selectedCourse?.id === courseId) {
          setSelectedCourse(null);
        }
      } else {
        toast({ title: "Failed to delete course", variant: "destructive" });
      }
    }
  };

  const handleCreateLesson = () => {
    if (!selectedCourse) {
      toast({ title: "Please select a course first", variant: "destructive" });
      return;
    }
    setLessonForm({
      title: "",
      description: "",
      videoUrl: "",
      notes: "",
      isPreview: false
    });
    setEditingLesson(null);
    setIsLessonDialogOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setLessonForm({
      title: lesson.title,
      description: lesson.description,
      videoUrl: lesson.videoUrl || "",
      notes: lesson.notes,
      isPreview: lesson.isPreview
    });
    setEditingLesson(lesson);
    setIsLessonDialogOpen(true);
  };

  const handleSaveLesson = () => {
    if (!selectedCourse) {
      toast({ title: "No course selected", variant: "destructive" });
      return;
    }

    if (!lessonForm.title) {
      toast({ title: "Please provide a lesson title", variant: "destructive" });
      return;
    }

    const lessonData = {
      courseId: selectedCourse.id,
      title: lessonForm.title,
      description: lessonForm.description,
      videoUrl: lessonForm.videoUrl || null,
      notes: lessonForm.notes,
      order: lessons.length + 1,
      isPreview: lessonForm.isPreview
    };

    if (editingLesson) {
      // Update existing lesson
      const updated = mockCourseApi.updateLesson(editingLesson.id, lessonData);
      if (updated) {
        toast({ title: "Lesson updated successfully" });
        loadCourseData(selectedCourse.id);
        setIsLessonDialogOpen(false);
      } else {
        toast({ title: "Failed to update lesson", variant: "destructive" });
      }
    } else {
      // Create new lesson
      const newLesson = mockCourseApi.createLesson(lessonData);
      toast({ title: "Lesson created successfully" });
      loadCourseData(selectedCourse.id);
      setIsLessonDialogOpen(false);
    }
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (confirm("Are you sure you want to delete this lesson?")) {
      const deleted = mockCourseApi.deleteLesson(lessonId);
      if (deleted) {
        toast({ title: "Lesson deleted successfully" });
        if (selectedCourse) {
          loadCourseData(selectedCourse.id);
        }
      } else {
        toast({ title: "Failed to delete lesson", variant: "destructive" });
      }
    }
  };

  const handleCreateResource = () => {
    if (!selectedCourse) {
      toast({ title: "Please select a course first", variant: "destructive" });
      return;
    }
    setResourceForm({
      title: "",
      url: "",
      type: "pdf"
    });
    setEditingResource(null);
    setIsResourceDialogOpen(true);
  };

  const handleEditResource = (resource: Resource) => {
    setResourceForm({
      title: resource.title,
      url: resource.url,
      type: resource.type
    });
    setEditingResource(resource);
    setIsResourceDialogOpen(true);
  };

  const handleSaveResource = () => {
    if (!selectedCourse) {
      toast({ title: "No course selected", variant: "destructive" });
      return;
    }

    if (!resourceForm.title || !resourceForm.url) {
      toast({ title: "Please provide a title and URL for the resource", variant: "destructive" });
      return;
    }

    const resourceData = {
      courseId: selectedCourse.id,
      title: resourceForm.title,
      url: resourceForm.url,
      type: resourceForm.type as "pdf" | "zip" | "other"
    };

    if (editingResource) {
      // Update existing resource
      const updated = mockCourseApi.updateLesson(editingResource.id, resourceData);
      if (updated) {
        toast({ title: "Resource updated successfully" });
        loadCourseData(selectedCourse.id);
        setIsResourceDialogOpen(false);
      } else {
        toast({ title: "Failed to update resource", variant: "destructive" });
      }
    } else {
      // Create new resource
      const newResource = mockCourseApi.createResource(resourceData);
      toast({ title: "Resource created successfully" });
      loadCourseData(selectedCourse.id);
      setIsResourceDialogOpen(false);
    }
  };

  const handleDeleteResource = (resourceId: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
      const deleted = mockCourseApi.deleteResource(resourceId);
      if (deleted) {
        toast({ title: "Resource deleted successfully" });
        if (selectedCourse) {
          loadCourseData(selectedCourse.id);
        }
      } else {
        toast({ title: "Failed to delete resource", variant: "destructive" });
      }
    }
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">Course Builder</h1>
          <p className="text-muted-foreground text-lg">
            Create and manage your courses
          </p>
        </div>
        <Button onClick={handleCreateCourse} data-testid="button-create-course">
          <Plus className="h-4 w-4 mr-2" />
          Create Course
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Your Courses</CardTitle>
            <CardDescription>Manage your course catalog</CardDescription>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't created any courses yet</p>
                <Button onClick={handleCreateCourse}>Create Your First Course</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover-elevate ${
                      selectedCourse?.id === course.id ? "bg-accent border-primary" : "border-card-border"
                    }`}
                    onClick={() => handleSelectCourse(course)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-semibold">{course.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{course.category}</Badge>
                          <Badge variant="outline">
                            {course.price > 0 ? `${course.currency === 'INR' ? '₹' : ''}${course.price}` : 'Free'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCourse(course);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(course.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{selectedCourse.title}</CardTitle>
                      <CardDescription>{selectedCourse.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{selectedCourse.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-semibold">
                        {selectedCourse.price > 0 
                          ? `${selectedCourse.currency === 'INR' ? '₹' : ''}${selectedCourse.price}` 
                          : 'Free'}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">{selectedCourse.duration}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Enrolled</p>
                      <p className="font-semibold">{selectedCourse.enrolledCount} students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        Lessons
                      </CardTitle>
                      <Button size="sm" onClick={handleCreateLesson}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Lesson
                      </Button>
                    </div>
                    <CardDescription>Manage course lessons</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {lessons.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No lessons added yet</p>
                        <Button onClick={handleCreateLesson}>Create First Lesson</Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lessons.map((lesson) => (
                            <TableRow key={lesson.id}>
                              <TableCell className="font-medium">{lesson.title}</TableCell>
                              <TableCell>
                                {lesson.isPreview ? (
                                  <Badge variant="secondary">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Preview
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditLesson(lesson)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteLesson(lesson.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Resources
                      </CardTitle>
                      <Button size="sm" onClick={handleCreateResource}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Resource
                      </Button>
                    </div>
                    <CardDescription>Downloadable course materials</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {resources.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No resources added yet</p>
                        <Button onClick={handleCreateResource}>Add First Resource</Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resources.map((resource) => (
                            <TableRow key={resource.id}>
                              <TableCell className="font-medium">{resource.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{resource.type.toUpperCase()}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditResource(resource)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleDeleteResource(resource.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Play className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">Select a Course</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a course from the list to start building lessons and resources
                </p>
                <Button onClick={handleCreateCourse}>Create New Course</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Course Dialog */}
      <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse ? "Edit Course" : "Create New Course"}</DialogTitle>
            <DialogDescription>
              {selectedCourse ? "Update your course details" : "Create a new course for your students"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course-title">Course Title *</Label>
              <Input
                id="course-title"
                value={courseForm.title}
                onChange={(e) => setCourseForm({...courseForm, title: e.target.value})}
                placeholder="Course Title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-description">Description *</Label>
              <Textarea
                id="course-description"
                value={courseForm.description}
                onChange={(e) => setCourseForm({...courseForm, description: e.target.value})}
                placeholder="Describe what students will learn in this course"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-category">Category *</Label>
                <Select value={courseForm.category} onValueChange={(value) => setCourseForm({...courseForm, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-duration">Duration *</Label>
                <Input
                  id="course-duration"
                  value={courseForm.duration}
                  onChange={(e) => setCourseForm({...courseForm, duration: e.target.value})}
                  placeholder="Duration"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="course-price">Price</Label>
                <Input
                  id="course-price"
                  type="number"
                  value={courseForm.price}
                  onChange={(e) => setCourseForm({...courseForm, price: e.target.value})}
                  placeholder="0 for free"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-currency">Currency</Label>
                <Select value={courseForm.currency} onValueChange={(value) => setCourseForm({...courseForm, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCourseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCourse}>
              <Save className="h-4 w-4 mr-2" />
              {selectedCourse ? "Update Course" : "Create Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={isLessonDialogOpen} onOpenChange={setIsLessonDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLesson ? "Edit Lesson" : "Create New Lesson"}</DialogTitle>
            <DialogDescription>
              {editingLesson ? "Update your lesson details" : "Add a new lesson to your course"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lesson-title">Lesson Title *</Label>
              <Input
                id="lesson-title"
                value={lessonForm.title}
                onChange={(e) => setLessonForm({...lessonForm, title: e.target.value})}
                placeholder="Lesson Title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-description">Description</Label>
              <Textarea
                id="lesson-description"
                value={lessonForm.description}
                onChange={(e) => setLessonForm({...lessonForm, description: e.target.value})}
                placeholder="Brief description of what this lesson covers"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-video">Video URL</Label>
              <div className="flex gap-2">
                <Input
                  id="lesson-video"
                  value={lessonForm.videoUrl}
                  onChange={(e) => setLessonForm({...lessonForm, videoUrl: e.target.value})}
                  placeholder="Video URL"
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lesson-notes">Lesson Notes</Label>
              <Textarea
                id="lesson-notes"
                value={lessonForm.notes}
                onChange={(e) => setLessonForm({...lessonForm, notes: e.target.value})}
                placeholder="Key points, code examples, or additional information"
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="lesson-preview"
                checked={lessonForm.isPreview}
                onChange={(e) => setLessonForm({...lessonForm, isPreview: e.target.checked})}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
              />
              <Label htmlFor="lesson-preview">Make this a preview lesson (available to non-enrolled users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLessonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLesson}>
              <Save className="h-4 w-4 mr-2" />
              {editingLesson ? "Update Lesson" : "Create Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Dialog */}
      <Dialog open={isResourceDialogOpen} onOpenChange={setIsResourceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingResource ? "Edit Resource" : "Add New Resource"}</DialogTitle>
            <DialogDescription>
              {editingResource ? "Update your resource details" : "Add downloadable materials for your course"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resource-title">Resource Title *</Label>
              <Input
                id="resource-title"
                value={resourceForm.title}
                onChange={(e) => setResourceForm({...resourceForm, title: e.target.value})}
                placeholder="Resource Title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-url">File URL *</Label>
              <div className="flex gap-2">
                <Input
                  id="resource-url"
                  value={resourceForm.url}
                  onChange={(e) => setResourceForm({...resourceForm, url: e.target.value})}
                  placeholder="Resource URL"
                />
                <Button variant="outline" size="icon">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-type">File Type</Label>
              <Select value={resourceForm.type} onValueChange={(value) => setResourceForm({...resourceForm, type: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="zip">ZIP Archive</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResourceDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveResource}>
              <Save className="h-4 w-4 mr-2" />
              {editingResource ? "Update Resource" : "Add Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}