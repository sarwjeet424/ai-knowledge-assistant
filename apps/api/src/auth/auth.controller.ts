import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentOrg, AuthenticatedOrganization } from '../common/current-org.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
@ApiTags('auth') @Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }
  @HttpCode(200) @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto.email, dto.password); }
  @HttpCode(204) @Post('logout') logout() { return; }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentOrg() org: AuthenticatedOrganization) { return this.auth.me(org.id); }
}
