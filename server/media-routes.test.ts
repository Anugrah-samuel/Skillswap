import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import mediaRoutes from './media-routes';
import { mediaService } from './services/media';
import { AuthService } from './auth';

// Mock the media service
vi.mock('./services/media', () => ({
  mediaService: {
    uploadFile: vi.fn(),
    getFileUrl: vi.fn(),
    deleteFile: vi.fn(),
    getUserFiles: vi.fn(),
    getRelatedFiles: vi.fn(),
  },
}));

// Mock the auth middleware
vi.mock('./auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

// Mock the upload middleware
vi.mock('./middleware/upload', () => ({
  uploadSingle: (req: any, res: any, next: any) => {
    req.file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('test'),
    };
    next();
  },
  uploadMultiple: (req: any, res: any, next: any) => {
    req.files = [
      {
        originalname: 'test1.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('test1'),
      },
      {
        originalname: 'test2.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
        buffer: Buffer.from('test2'),
      },
    ];
    next();
  },
  handleUploadError: (error: any, req: any, res: any, next: any) => {
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    next();
  },
}));

// Mock validation middleware
vi.mock('./middleware/validation', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next(),
}));

describe('Media Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/media', mediaRoutes);
    vi.clearAllMocks();
  });

  describe('POST /api/media/upload', () => {
    it('should upload a single file successfully', async () => {
      const mockMediaFile = {
        id: 'file-id',
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        fileType: 'image',
        cdnUrl: 'https://cdn.example.com/test.jpg',
        processingStatus: 'pending',
        createdAt: new Date(),
      };

      vi.mocked(mediaService.uploadFile).mockResolvedValue(mockMediaFile as any);

      const response = await request(app)
        .post('/api/media/upload')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('file-id');
      expect(response.body.data.filename).toBe('test.jpg');
      expect(mediaService.uploadFile).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should return error when no file is provided', async () => {
      // Override the upload middleware for this test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { id: 'test-user-id' };
        next();
      });
      testApp.use('/api/media', mediaRoutes);

      const response = await request(testApp)
        .post('/api/media/upload')
        .expect(400);

      expect(response.body.error).toBe('No file provided');
    });

    it('should handle upload errors', async () => {
      vi.mocked(mediaService.uploadFile).mockRejectedValue(new Error('Upload failed'));

      const response = await request(app)
        .post('/api/media/upload')
        .expect(500);

      expect(response.body.error).toBe('Upload failed');
    });
  });

  describe('POST /api/media/upload-multiple', () => {
    it('should upload multiple files successfully', async () => {
      const mockMediaFiles = [
        {
          id: 'file-id-1',
          filename: 'test1.jpg',
          originalName: 'test1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          fileType: 'image',
          cdnUrl: 'https://cdn.example.com/test1.jpg',
          processingStatus: 'pending',
          createdAt: new Date(),
        },
        {
          id: 'file-id-2',
          filename: 'test2.jpg',
          originalName: 'test2.jpg',
          mimeType: 'image/jpeg',
          fileSize: 2048,
          fileType: 'image',
          cdnUrl: 'https://cdn.example.com/test2.jpg',
          processingStatus: 'pending',
          createdAt: new Date(),
        },
      ];

      vi.mocked(mediaService.uploadFile)
        .mockResolvedValueOnce(mockMediaFiles[0] as any)
        .mockResolvedValueOnce(mockMediaFiles[1] as any);

      const response = await request(app)
        .post('/api/media/upload-multiple')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('file-id-1');
      expect(response.body.data[1].id).toBe('file-id-2');
      expect(mediaService.uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/media/:id', () => {
    it('should return file URL for existing file', async () => {
      const mockUrl = 'https://cdn.example.com/secure-url';
      vi.mocked(mediaService.getFileUrl).mockResolvedValue(mockUrl);

      const response = await request(app)
        .get('/api/media/file-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe(mockUrl);
      expect(mediaService.getFileUrl).toHaveBeenCalledWith('file-id', undefined);
    });

    it('should return 404 for non-existent file', async () => {
      vi.mocked(mediaService.getFileUrl).mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get('/api/media/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('File not found');
    });

    it('should return 403 for access denied', async () => {
      vi.mocked(mediaService.getFileUrl).mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .get('/api/media/file-id')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('DELETE /api/media/:id', () => {
    it('should delete file successfully', async () => {
      vi.mocked(mediaService.deleteFile).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/media/file-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File deleted successfully');
      expect(mediaService.deleteFile).toHaveBeenCalledWith('file-id', 'test-user-id');
    });

    it('should return 404 for non-existent file', async () => {
      vi.mocked(mediaService.deleteFile).mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/media/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('File not found');
    });

    it('should return 403 for access denied', async () => {
      vi.mocked(mediaService.deleteFile).mockRejectedValue(new Error('Access denied'));

      const response = await request(app)
        .delete('/api/media/file-id')
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/media/user/files', () => {
    it('should return user files with pagination', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test1.jpg',
          originalName: 'test1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          fileType: 'image',
          cdnUrl: 'https://cdn.example.com/test1.jpg',
          processingStatus: 'completed',
          createdAt: new Date(),
        },
        {
          id: 'file-2',
          filename: 'test2.jpg',
          originalName: 'test2.jpg',
          mimeType: 'image/jpeg',
          fileSize: 2048,
          fileType: 'image',
          cdnUrl: 'https://cdn.example.com/test2.jpg',
          processingStatus: 'completed',
          createdAt: new Date(),
        },
      ];

      vi.mocked(mediaService.getUserFiles).mockResolvedValue(mockFiles as any);

      const response = await request(app)
        .get('/api/media/user/files?page=1&limit=20')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
      expect(mediaService.getUserFiles).toHaveBeenCalledWith('test-user-id', undefined);
    });

    it('should filter files by type', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test1.jpg',
          originalName: 'test1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          fileType: 'image',
          cdnUrl: 'https://cdn.example.com/test1.jpg',
          processingStatus: 'completed',
          createdAt: new Date(),
        },
      ];

      vi.mocked(mediaService.getUserFiles).mockResolvedValue(mockFiles as any);

      const response = await request(app)
        .get('/api/media/user/files?fileType=image')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.files).toHaveLength(1);
      expect(mediaService.getUserFiles).toHaveBeenCalledWith('test-user-id', 'image');
    });
  });

  describe('GET /api/media/related/:type/:id', () => {
    it('should return related files', async () => {
      const mockFiles = [
        {
          id: 'file-1',
          filename: 'course-material.pdf',
          originalName: 'course-material.pdf',
          mimeType: 'application/pdf',
          fileSize: 5120,
          fileType: 'document',
          cdnUrl: 'https://cdn.example.com/course-material.pdf',
          processingStatus: 'completed',
          createdAt: new Date(),
        },
      ];

      vi.mocked(mediaService.getRelatedFiles).mockResolvedValue(mockFiles as any);

      const response = await request(app)
        .get('/api/media/related/course/course-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('file-1');
      expect(mediaService.getRelatedFiles).toHaveBeenCalledWith('course', 'course-id');
    });

    it('should return 400 for invalid related type', async () => {
      const response = await request(app)
        .get('/api/media/related/invalid/some-id')
        .expect(400);

      expect(response.body.error).toBe('Invalid related type');
    });
  });
});