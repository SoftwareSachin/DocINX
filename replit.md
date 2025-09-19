# Overview

DocINX is an enterprise document intelligence platform that transforms unstructured documents (PDFs, text, DOCX) into searchable, AI-ready knowledge using Retrieval-Augmented Generation (RAG) technology. The platform enables users to upload documents, extract text content, generate embeddings for semantic search, and interact with document knowledge through a conversational AI interface.

The application follows a full-stack architecture with a React frontend, Express.js backend, PostgreSQL database with Drizzle ORM, and integrates OpenAI's GPT and embedding models for AI-powered document processing and chat functionality.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **UI Library**: Shadcn/ui components with Radix UI primitives and Tailwind CSS
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Currently configured for no-authentication mode with mock user data

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with structured route handling
- **File Processing**: Multer for file uploads with memory storage
- **Document Processing**: Custom document processor service for text extraction and chunking
- **Vector Operations**: Custom vector service for embedding generation and similarity search

## Database Schema
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Core Tables**:
  - `users`: User management (required for Replit Auth compatibility)
  - `documents`: Document metadata and processing status
  - `chunks`: Text chunks with embeddings for RAG
  - `chatSessions`: Chat conversation sessions
  - `chatMessages`: Individual chat messages with sources
  - `sessions`: Session storage (required for Replit Auth)

## AI Integration
- **LLM Provider**: OpenAI GPT-5 for chat completions
- **Embeddings**: OpenAI text-embedding-3-small for document vectorization
- **RAG Pipeline**: Document chunking → embedding generation → vector similarity search → context-aware response generation

## Document Processing Pipeline
1. **Upload**: File validation and storage using Multer
2. **Text Extraction**: Support for PDF, DOCX, and plain text files
3. **Chunking**: Text segmentation for optimal embedding generation
4. **Embedding**: Vector generation using OpenAI embeddings API
5. **Storage**: Chunk storage with metadata and vector data

## Authentication Strategy
- **Current Mode**: No authentication required (anonymous user mode)
- **Replit Auth Ready**: Infrastructure prepared for Replit OAuth integration
- **Session Management**: PostgreSQL-based session storage with connect-pg-simple

# External Dependencies

## AI Services
- **OpenAI API**: GPT-5 for chat completions and text-embedding-3-small for document vectorization
- **Required Environment Variables**: `OPENAI_API_KEY` or `OPENAI_API_KEY_ENV_VAR`

## Database
- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Environment Variable**: `DATABASE_URL` for database connection
- **ORM**: Drizzle Kit for migrations and schema management

## Development Tools
- **Vite**: Frontend build tool with React plugin and development server
- **Replit Integration**: Development banner and cartographer plugins for Replit environment
- **TypeScript**: Type safety across frontend and backend with shared schema types

## UI Components
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Lucide React**: Icon library for consistent iconography

## File Processing
- **Multer**: Express middleware for handling multipart/form-data file uploads
- **PDF Processing**: Integration ready for PDF text extraction libraries
- **Document Types**: Support for PDF, DOCX, and plain text file formats