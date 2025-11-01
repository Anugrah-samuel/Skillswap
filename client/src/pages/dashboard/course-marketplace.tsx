import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Search, Play, FileText, Users, IndianRupee, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mockCourseApi, type Course, type Enrollment } from "@/lib/mockCourseApi";

const categories = ["All", "Technology", "Design", "Business", "Languages", "Arts", "Fitness", "Music", "Cooking"];

export default function CourseMarketplace() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState("popular");

  // Load courses and enrollments on component mount
  useEffect(() => {
    loadCourses();
    loadEnrollments();
  }, []);

  // Filter and sort courses when search, category, or sort changes
  useEffect(() => {
    let result = [...courses];

    // Apply search filter
    if (searchQuery) {
      result = result.filter(course => 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.instructorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== "All") {
      result = result.filter(course => course.category === selectedCategory);
    }

    // Apply sorting
    switch (sortBy) {
      case "popular":
        result.sort((a, b) => b.enrolledCount - a.enrolledCount);
        break;
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "price-low":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result.sort((a, b) => b.price - a.price);
        break;
    }

    setFilteredCourses(result);
  }, [courses, searchQuery, selectedCategory, sortBy]);

  const loadCourses = () => {
    const allCourses = mockCourseApi.getCourses();
    setCourses(allCourses);
  };

  const loadEnrollments = () => {
    const userEnrollments = mockCourseApi.getEnrollmentsByUser(""); // User ID will be loaded from auth
    setEnrollments(userEnrollments);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
  };

  const handleViewCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsPreviewDialogOpen(true);
  };

  const handlePurchaseCourse = (course: Course) => {
    setSelectedCourse(course);
    setIsPreviewDialogOpen(false);
    setIsPurchaseDialogOpen(true);
  };

  const handleConfirmPurchase = () => {
    if (!selectedCourse) return;

    // Mock purchase process
    try {
      mockCourseApi.purchaseCourse("", selectedCourse.id, selectedCourse.price, selectedCourse.currency); // User ID will be loaded from auth
      toast({ title: "Course purchased successfully!" });
      setIsPurchaseDialogOpen(false);
      loadEnrollments();
    } catch (error) {
      toast({ title: "Failed to purchase course", variant: "destructive" });
    }
  };

  const isEnrolledInCourse = (courseId: string) => {
    return enrollments.some(enrollment => enrollment.courseId === courseId);
  };

  const getPreviewLesson = (course: Course) => {
    if (course.previewLessonId) {
      const lessons = mockCourseApi.getLessonsByCourse(course.id);
      return lessons.find(lesson => lesson.id === course.previewLessonId);
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Course Marketplace</h1>
        <p className="text-muted-foreground text-lg">
          Browse and enroll in courses created by our community
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses, instructors, or topics..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No courses found matching your criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = isEnrolledInCourse(course.id);
            const previewLesson = getPreviewLesson(course);
            
            return (
              <Card 
                key={course.id} 
                className="hover-elevate transition-all cursor-pointer"
                onClick={() => handleViewCourse(course)}
              >
                <CardHeader className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <CardTitle className="text-lg line-clamp-2">{course.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {course.instructorName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{course.instructorName}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{course.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{course.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-current text-yellow-500" />
                      <span className="text-sm font-medium">{course.rating > 0 ? course.rating.toFixed(1) : 'New'}</span>
                      <span className="text-xs text-muted-foreground">({course.totalReviews})</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4" />
                      <span>{course.enrolledCount}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {course.price > 0 ? (
                        <div className="flex items-center">
                          {course.currency === 'INR' ? (
                            <IndianRupee className="h-4 w-4" />
                          ) : (
                            <Coins className="h-4 w-4" />
                          )}
                          <span className="font-semibold">{course.price}</span>
                        </div>
                      ) : (
                        <Badge variant="default">Free</Badge>
                      )}
                    </div>
                    
                    {isEnrolled ? (
                      <Button size="sm" variant="outline">
                        <Play className="h-4 w-4 mr-2" />
                        Continue
                      </Button>
                    ) : (
                      <Button size="sm">
                        {course.price > 0 ? "Purchase" : "Enroll"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Course Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.title}</DialogTitle>
            <DialogDescription>{selectedCourse?.description}</DialogDescription>
          </DialogHeader>
          
          {selectedCourse && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-lg font-semibold">
                    {selectedCourse.instructorName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedCourse.instructorName}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-yellow-500" />
                    <span className="text-sm">{selectedCourse.rating > 0 ? selectedCourse.rating.toFixed(1) : 'No ratings'}</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="secondary">{selectedCourse.category}</Badge>
                  <Badge variant="outline">
                    {selectedCourse.price > 0 
                      ? `${selectedCourse.currency === 'INR' ? '₹' : ''}${selectedCourse.price}` 
                      : 'Free'}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold">{selectedCourse.duration}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Enrolled</p>
                  <p className="font-semibold">{selectedCourse.enrolledCount} students</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-yellow-500" />
                    <span className="font-semibold">{selectedCourse.rating > 0 ? selectedCourse.rating.toFixed(1) : 'No ratings'}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">What you'll learn</h3>
                <p className="text-muted-foreground">{selectedCourse.description}</p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Course Content</h3>
                <div className="space-y-2">
                  {mockCourseApi.getLessonsByCourse(selectedCourse.id).slice(0, 3).map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Play className="h-4 w-4" />
                      <span className="text-sm">{lesson.title}</span>
                      {lesson.isPreview && (
                        <Badge variant="secondary" className="ml-auto">
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </Badge>
                      )}
                    </div>
                  ))}
                  {mockCourseApi.getLessonsByCourse(selectedCourse.id).length > 3 && (
                    <p className="text-sm text-muted-foreground text-center">
                      + {mockCourseApi.getLessonsByCourse(selectedCourse.id).length - 3} more lessons
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Resources</h3>
                <div className="space-y-2">
                  {mockCourseApi.getResourcesByCourse(selectedCourse.id).slice(0, 2).map((resource) => (
                    <div key={resource.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{resource.title}</span>
                      <Badge variant="outline" className="ml-auto">
                        {resource.type.toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                  {mockCourseApi.getResourcesByCourse(selectedCourse.id).length > 2 && (
                    <p className="text-sm text-muted-foreground text-center">
                      + {mockCourseApi.getResourcesByCourse(selectedCourse.id).length - 2} more resources
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close
            </Button>
            {selectedCourse && !isEnrolledInCourse(selectedCourse.id) && (
              <Button onClick={() => handlePurchaseCourse(selectedCourse)}>
                {selectedCourse.price > 0 ? "Purchase Course" : "Enroll for Free"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              {selectedCourse?.price && selectedCourse.currency === 'INR' 
                ? `Are you sure you want to purchase "${selectedCourse.title}" for ₹${selectedCourse.price}?` 
                : `Are you sure you want to purchase "${selectedCourse?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCourse && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-semibold">{selectedCourse.title}</p>
                  <p className="text-sm text-muted-foreground">{selectedCourse.instructorName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {selectedCourse.price > 0 
                      ? `${selectedCourse.currency === 'INR' ? '₹' : ''}${selectedCourse.price}` 
                      : 'Free'}
                  </p>
                  {selectedCourse.price > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Includes 20% platform fee
                    </p>
                  )}
                </div>
              </div>
              
              {selectedCourse.price > 0 && (
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Course Price:</span>
                    <span>{selectedCourse.currency === 'INR' ? '₹' : ''}{selectedCourse.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee (20%):</span>
                    <span>{selectedCourse.currency === 'INR' ? '₹' : ''}{(selectedCourse.price * 0.2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total:</span>
                    <span>{selectedCourse.currency === 'INR' ? '₹' : ''}{selectedCourse.price}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPurchase}>
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}