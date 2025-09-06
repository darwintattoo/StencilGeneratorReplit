# TattooStencilPro - AI-Powered Tattoo Stencil Generator

## Overview

TattooStencilPro is a specialized web application that converts regular images into tattoo stencils using AI-powered image processing. The application leverages ComfyDeploy's AI workflows to transform uploaded images into line art suitable for tattoo applications. Users can upload images, customize stencil parameters (line color, transparency, enhancement options), and edit the generated stencils using a Procreate-style canvas editor.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using React with TypeScript, following a modern component-based architecture:

- **Framework**: React 18 with TypeScript for type safety
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Canvas Rendering**: Konva.js for the stencil editor with touch/gesture support
- **State Management**: React Query for server state and React Context for client state
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Session-based auth with Express sessions

### Backend Architecture
The backend follows a RESTful API design with Express.js:

- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle with PostgreSQL schema definitions
- **Authentication**: Passport.js with local strategy and session storage
- **File Handling**: Multer for image uploads with security validation
- **Security**: Comprehensive middleware for input validation, CSRF protection, and rate limiting

### Key Design Patterns
- **Separation of Concerns**: Clear separation between client, server, and shared code
- **Type Safety**: Shared TypeScript schemas between frontend and backend
- **Progressive Enhancement**: Fallback UI states for API failures
- **Responsive Design**: Mobile-first approach with touch gesture support

### Canvas Editor Architecture
The stencil editor implements a custom hook pattern (`useStencilCanvas`) that encapsulates:
- Drawing tool state management (brush, eraser, move tools)
- Layer management system (drawing, stencil, original layers)
- Viewport transformations (pan, zoom, reset)
- Touch gesture handling for mobile devices
- Real-time brush/eraser size adjustments

## External Dependencies

### AI Processing Service
- **ComfyDeploy API**: Core AI service for image-to-stencil conversion
  - Endpoint: `https://api.comfydeploy.com/api/run/deployment/queue`
  - Deployment ID: `c0887fe6-13b0-4406-a8d1-f596b1fdab8d`
  - Supports custom parameters: line color, transparency, shadow enhancement, AI models

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database for production
- **Connection**: Uses connection pooling via `@neondatabase/serverless`
- **Schema**: User management, stencil storage, and session data

### Authentication & Sessions
- **connect-pg-simple**: PostgreSQL session store for persistent sessions
- **Passport.js**: Authentication middleware with local username/password strategy

### Image Processing & Storage
- **AWS S3**: ComfyDeploy uses S3 for generated image storage
- **Local Storage**: Temporary file storage for uploaded images before processing
- **File Validation**: Comprehensive MIME type and size validation

### UI & Interaction Libraries
- **Radix UI**: Accessible component primitives for dialogs, dropdowns, etc.
- **Framer Motion**: Animation library for smooth UI transitions
- **react-konva**: Canvas rendering for the stencil editor
- **react-compare-slider**: Before/after image comparison component
- **file-saver**: Client-side file download functionality

### Development & Build Tools
- **TypeScript**: Full-stack type safety
- **ESBuild**: Fast bundling for production server builds
- **PostCSS**: CSS processing with Tailwind CSS
- **Replit Integration**: Development environment optimizations