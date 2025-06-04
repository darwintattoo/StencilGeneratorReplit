# TattooStencilPro

Professional tattoo stencil generation web application with advanced AI image processing and CLAHE enhancement.

## Features

- **AI-Powered Stencil Generation**: Uses ComfyDeploy API for high-quality tattoo stencil creation
- **Advanced Image Processing**: Real CLAHE (Contrast Limited Adaptive Histogram Equalization) implementation
- **Custom Parameters**: Adjustable clip limit (1.0-10.0) and tile size (4x4 to 16x16)
- **Multiple Line Colors**: Black, red, and blue stencil options
- **Transparent Backgrounds**: Optional transparent PNG output
- **User Authentication**: Secure login system with PostgreSQL storage
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: React.js with TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js with Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Image Processing**: Sharp library with custom CLAHE implementation
- **AI Integration**: ComfyDeploy API for stencil generation

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   - Configure PostgreSQL connection in environment variables
   - Run database migrations: `npm run db:push`

3. **Environment Variables**
   ```bash
   DATABASE_URL=your_postgresql_connection_string
   API_KEY=your_comfydeploy_api_key
   COMFY_DEPLOYMENT_ID=your_deployment_id
   SESSION_SECRET=your_session_secret
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## CLAHE Parameters

The application implements a real CLAHE algorithm with these configurable parameters:

- **Clip Limit**: Controls contrast enhancement intensity (recommended: 2.0)
- **Tile Size**: Size of processing regions for local adaptation (recommended: 8x8)
- **Color Space**: Processes images in LAB color space (L channel)

## API Endpoints

- `POST /api/upload-image`: Upload and process images
- `GET /api/queue/:runId`: Check processing status
- `POST /api/register`: User registration
- `POST /api/login`: User authentication
- `POST /api/logout`: User logout
- `GET /api/user`: Get current user

## Image Processing Pipeline

1. Image upload and validation
2. Optional CLAHE enhancement (if enabled)
3. ComfyDeploy API processing
4. Stencil generation with custom parameters
5. Result delivery and storage

## Development

- **Start server**: `npm run dev`
- **Database push**: `npm run db:push`
- **Type checking**: `npx tsc --noEmit`

## Architecture

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── scripts/         # Database utilities
└── uploads/         # Image storage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with proper TypeScript types
4. Add tests for new functionality
5. Submit a pull request

## License

Private project - All rights reserved