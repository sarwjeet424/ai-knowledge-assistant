import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      mock: process.env.MOCK_AI !== 'false',
    };
  }
}
