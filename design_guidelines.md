# SkillSwap Design Guidelines

## Design Approach
**System-Based with Custom Refinement**: Drawing from Linear's minimalist professionalism and Notion's clean hierarchy, adapted for a trust-focused skill exchange platform. The black-and-white constraint demands exceptional typography and spatial design.

## Color Palette

### Core Colors (Dark Mode Primary)
- **Background**: 0 0% 9% (rich black, not pure black)
- **Surface**: 0 0% 12% (cards, panels)
- **Surface Elevated**: 0 0% 15% (modals, dropdowns)
- **Border**: 0 0% 20% (subtle separators)
- **Border Emphasis**: 0 0% 30% (interactive element borders)

### Text Colors
- **Primary Text**: 0 0% 95% (high contrast white)
- **Secondary Text**: 0 0% 65% (muted for descriptions)
- **Tertiary Text**: 0 0% 45% (labels, metadata)

### Interactive States
- **Hover Background**: 0 0% 18%
- **Active Background**: 0 0% 22%
- **Focus Ring**: 0 0% 90% (bright white outline)

### Light Mode Alternative
- **Background**: 0 0% 98%
- **Surface**: 0 0% 100%
- **Primary Text**: 0 0% 10%
- **Borders**: 0 0% 88%

## Typography

**Font Stack**: Inter (primary), -apple-system fallback
- **Hero Heading**: 72px/80px, font-weight: 700, letter-spacing: -0.02em
- **Page Title**: 48px/56px, font-weight: 700
- **Section Heading**: 32px/40px, font-weight: 600
- **Card Title**: 20px/28px, font-weight: 600
- **Body Large**: 18px/28px, font-weight: 400
- **Body**: 16px/24px, font-weight: 400
- **Body Small**: 14px/20px, font-weight: 400
- **Caption**: 12px/16px, font-weight: 500, uppercase, letter-spacing: 0.05em

## Layout System

**Spacing Scale**: Use Tailwind units 2, 4, 6, 8, 12, 16, 20, 24 consistently
- **Component Padding**: p-6 to p-8
- **Section Spacing**: py-16 to py-24
- **Card Gap**: gap-6
- **Container Max Width**: max-w-7xl

**Grid Strategy**:
- Dashboard: Sidebar (280px fixed) + Main content (fluid)
- Skill Cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Feature Highlights: grid-cols-1 md:grid-cols-3
- Chat Layout: 3-column (Users 300px | Messages fluid | Details 320px)

## Component Library

### Landing Page
**Hero Section**: Full viewport (min-h-screen), centered content with:
- Large headline (72px bold)
- Subtitle (24px, muted)
- Dual CTA buttons (Sign Up primary white bg + Login outline)
- Background: Subtle geometric pattern or gradient from 9% to 12% gray

**Feature Cards**: 
- White border (border-2)
- p-8 padding
- Hover: lift effect (transform translateY(-4px)) + border brightens to 30% gray
- Icon (48px), title (24px), description (16px muted)

### Dashboard
**Sidebar Navigation**:
- Fixed left, w-72, bg-surface (12% gray)
- Active item: bg-[15% gray] + border-l-4 border-white
- Icons: 20px, text: 16px
- Hover: bg-[15% gray] smooth transition

**Dashboard Cards**:
- bg-surface, border border-[20% gray]
- Rounded-xl (12px radius)
- Shadow: subtle (0 4px 12px rgba(0,0,0,0.1))
- Hover: border-[30% gray]

### Skill Cards
- Compact card: p-6, min-h-[200px]
- Skill name (20px bold)
- Category badge (12px uppercase, border, px-3 py-1)
- User avatar (40px circle) + name + rating (stars)
- Description (14px, 2-line clamp)
- "Request Trade" button (outline, full-width)

### Chat Interface
**Message Bubbles**:
- Sent: bg-white, text-black, rounded-2xl, ml-auto, max-w-[70%]
- Received: bg-[15% gray], text-white, rounded-2xl, mr-auto, max-w-[70%]
- Timestamp: 12px, muted, mt-1
- Typing indicator: animated dots in muted gray

### Calendar
- Week/Month grid view
- Event blocks: bg-[15% gray], border-l-4 border-white
- Time slots: border-[20% gray]
- Hover: bg-[18% gray]

### Profile Card
- Large avatar (120px circle)
- Name (32px bold)
- Bio (16px, max-w-2xl)
- Skills grid below
- Star rating (24px stars)
- Edit button (outline, top-right)

### Modals
- bg-[12% gray], backdrop blur
- Max-w-2xl, rounded-2xl
- p-8, border border-[20% gray]
- Overlay: bg-black/50

### Buttons
**Primary**: bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-[90% gray] transition
**Outline**: border-2 border-white text-white px-6 py-3 rounded-lg hover:bg-white/10

### Form Elements
- Input: bg-[15% gray], border border-[30% gray], rounded-lg, px-4 py-3
- Focus: border-white, ring-2 ring-white/20
- Label: 14px, mb-2, text-[65% gray]

## Animations (Minimal)
- Hover transitions: 200ms ease
- Modal entrance: fade + scale (300ms)
- Page transitions: fade only (150ms)
- Button hover: 150ms ease
- NO scroll-triggered animations
- NO parallax effects

## Responsive Breakpoints
- Mobile: < 768px (single column, hidden sidebar with hamburger)
- Tablet: 768px - 1024px (2-column grids)
- Desktop: > 1024px (full layout)

## Images
**Hero Section**: Large background image showing diverse people collaborating/learning (grayscale filter, 40% opacity overlay). Full-width, min-h-screen.

**Profile Avatars**: Circular, grayscale preferred, 40px (cards) to 120px (profile page).

**Empty States**: Simple line illustrations in white/gray for "No skills yet", "No matches", etc.

## Iconography
Use Heroicons (outline style) via CDN, 20px for navigation, 16px inline, 48px for feature cards. All icons in white with opacity variations.