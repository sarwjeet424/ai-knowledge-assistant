import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const http = exception instanceof HttpException ? exception : undefined;
    const status = http?.getStatus() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = http?.getResponse();
    const message = typeof detail === 'object' && detail !== null && 'message' in detail
      ? (detail as { message: string | string[] }).message
      : (http?.message ?? 'An unexpected error occurred');
    response.status(status).json({
      success: false,
      error: {
        code: HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
