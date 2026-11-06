import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller'; import { AuthService } from './auth.service'; import { JwtStrategy } from './jwt.strategy';
@Module({ imports: [JwtModule.registerAsync({ imports:[ConfigModule], inject:[ConfigService], useFactory:(c: ConfigService) => ({ secret:c.getOrThrow<string>('auth.jwtSecret'), signOptions:{expiresIn:'8h'} }) })], controllers:[AuthController], providers:[AuthService, JwtStrategy], exports:[JwtModule] }) export class AuthModule {}
