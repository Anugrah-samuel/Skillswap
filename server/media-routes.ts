import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { mediaService } from './services/media';
import { uploadSingle, uploadMultiple, handleUploadError } from './middleware/upload';
import { authenticateToken, type AuthenticatedRequest } from './auth';

const router = Router();

// Validation schemas
const uploadQuerySchema = z.object({
  relatedType: z.enum(['course', 'lesson', 'profile', 'message']).optional(),
  relatedId: z.string().uuid().optional(),
  isPublic: z.string().transform(val => val === 'true').optional(),
});

const fileParamsSchema = z.object({
  id: z.string().uuid(),
});

const getUserFilesQuerySchema = z.object({
  fileType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

/**
 * POST /api/media/upload
 * Upload a single file
 */
router.post('/upload', 
  authenticateToken,
  uploadSingle,
  handleUploadError,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file provided',
          message: 'Please select a file to upload',
        });
      }

      const userId = req.user!.userId;
      
      // Validate query parameters
      const queryValidation = uploadQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: queryValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { relatedType, relatedId, isPublic } = queryValidation.data;

      const mediaFile = await mediaService.uploadFile(userId, req.file, {
        relatedType,
        relatedId,
        isPublic,
      });

      res.status(201).json({
        success: true,
        data: {
          id: mediaFile.id,
          filename: mediaFile.filename,
          originalName: mediaFile.originalName,
          mimeType: mediaFile.mimeType,
          fileSize: mediaFile.fileSize,
          fileType: mediaFile.fileType,
          cdnUrl: mediaFile.cdnUrl,
          processingStatus: mediaFile.processingStatus,
          createdAt: mediaFile.createdAt,
        },
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message || 'An error occurred while uploading the file',
      });
    }
  }
);

/**
 * POST /api/media/upload-multiple
 * Upload multiple files
 */
router.post('/upload-multiple',
  authenticateToken,
  uploadMultiple,
  handleUploadError,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          error: 'No files provided',
          message: 'Please select at least one file to upload',
        });
      }

      const userId = req.user!.userId;
      
      // Validate query parameters
      const queryValidation = uploadQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: queryValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { relatedType, relatedId, isPublic } = queryValidation.data;

      const uploadPromises = req.files.map(file => 
        mediaService.uploadFile(userId, file, {
          relatedType,
          relatedId,
          isPublic,
        })
      );

      const mediaFiles = await Promise.all(uploadPromises);

      res.status(201).json({
        success: true,
        data: mediaFiles.map(mediaFile => ({
          id: mediaFile.id,
          filename: mediaFile.filename,
          originalName: mediaFile.originalName,
          mimeType: mediaFile.mimeType,
          fileSize: mediaFile.fileSize,
          fileType: mediaFile.fileType,
          cdnUrl: mediaFile.cdnUrl,
          processingStatus: mediaFile.processingStatus,
          createdAt: mediaFile.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Multiple file upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message || 'An error occurred while uploading the files',
      });
    }
  }
);

/**
 * GET /api/media/:id
 * Get secure access URL for a file
 */
router.get('/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate params
      const paramsValidation = fileParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: paramsValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { id } = paramsValidation.data;
      const userId = req.user?.userId;

      const fileUrl = await mediaService.getFileUrl(id, userId);

      res.json({
        success: true,
        data: {
          url: fileUrl,
        },
      });
    } catch (error: any) {
      console.error('Get file URL error:', error);
      
      if (error.message === 'File not found') {
        return res.status(404).json({
          error: 'File not found',
          message: 'The requested file does not exist',
        });
      }
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this file',
        });
      }

      res.status(500).json({
        error: 'Failed to get file URL',
        message: error.message || 'An error occurred while generating the file URL',
      });
    }
  }
);

/**
 * GET /api/media/:id/info
 * Get file information
 */
router.get('/:id/info',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate params
      const paramsValidation = fileParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: paramsValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { id } = paramsValidation.data;
      const userId = req.user!.userId;

      const mediaFile = await mediaService.getUserFiles(userId);
      const file = mediaFile.find(f => f.id === id);

      if (!file) {
        return res.status(404).json({
          error: 'File not found',
          message: 'The requested file does not exist or you do not have access to it',
        });
      }

      res.json({
        success: true,
        data: {
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          fileType: file.fileType,
          cdnUrl: file.cdnUrl,
          thumbnailUrl: file.thumbnailUrl,
          processedUrl: file.processedUrl,
          processingStatus: file.processingStatus,
          relatedType: file.relatedType,
          relatedId: file.relatedId,
          isPublic: file.isPublic,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Get file info error:', error);
      res.status(500).json({
        error: 'Failed to get file information',
        message: error.message || 'An error occurred while retrieving file information',
      });
    }
  }
);

/**
 * DELETE /api/media/:id
 * Delete a file
 */
router.delete('/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate params
      const paramsValidation = fileParamsSchema.safeParse(req.params);
      if (!paramsValidation.success) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: paramsValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { id } = paramsValidation.data;
      const userId = req.user!.userId;

      const deleted = await mediaService.deleteFile(id, userId);

      if (!deleted) {
        return res.status(404).json({
          error: 'File not found',
          message: 'The requested file does not exist or you do not have access to it',
        });
      }

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete file error:', error);
      
      if (error.message === 'Access denied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to delete this file',
        });
      }

      res.status(500).json({
        error: 'Failed to delete file',
        message: error.message || 'An error occurred while deleting the file',
      });
    }
  }
);

/**
 * GET /api/media/user/files
 * Get user's files
 */
router.get('/user/files',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      
      // Validate query parameters
      const queryValidation = getUserFilesQuerySchema.safeParse(req.query);
      if (!queryValidation.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          message: queryValidation.error.errors.map(e => e.message).join(', '),
        });
      }
      
      const { fileType, page, limit } = queryValidation.data;

      const allFiles = await mediaService.getUserFiles(userId, fileType);
      
      // Implement pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const files = allFiles.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          files: files.map(file => ({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            fileType: file.fileType,
            cdnUrl: file.cdnUrl,
            thumbnailUrl: file.thumbnailUrl,
            processingStatus: file.processingStatus,
            relatedType: file.relatedType,
            relatedId: file.relatedId,
            isPublic: file.isPublic,
            createdAt: file.createdAt,
          })),
          pagination: {
            page,
            limit,
            total: allFiles.length,
            totalPages: Math.ceil(allFiles.length / limit),
            hasNext: endIndex < allFiles.length,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error: any) {
      console.error('Get user files error:', error);
      res.status(500).json({
        error: 'Failed to get files',
        message: error.message || 'An error occurred while retrieving files',
      });
    }
  }
);

/**
 * GET /api/media/related/:type/:id
 * Get files related to a specific entity
 */
router.get('/related/:type/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, id } = req.params;
      
      // Validate related type
      const validTypes = ['course', 'lesson', 'profile', 'message'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Invalid related type',
          message: `Related type must be one of: ${validTypes.join(', ')}`,
        });
      }

      const files = await mediaService.getRelatedFiles(type, id);

      res.json({
        success: true,
        data: files.map(file => ({
          id: file.id,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          fileType: file.fileType,
          cdnUrl: file.cdnUrl,
          thumbnailUrl: file.thumbnailUrl,
          processingStatus: file.processingStatus,
          isPublic: file.isPublic,
          createdAt: file.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Get related files error:', error);
      res.status(500).json({
        error: 'Failed to get related files',
        message: error.message || 'An error occurred while retrieving related files',
      });
    }
  }
);

export default router;