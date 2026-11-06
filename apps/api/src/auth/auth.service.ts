import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './auth.dto';
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.organization.findUnique({ where: { email } })) throw new ConflictException('An organization with this email already exists');
    const organization = await this.prisma.organization.create({ data: { name: dto.name.trim(), email, passwordHash: await bcrypt.hash(dto.password, 12) } });
    return this.issue(organization);
  }
  async login(email: string, password: string) {
    const organization = await this.prisma.organization.findUnique({ where: { email: email.toLowerCase() } });
    if (!organization || !(await bcrypt.compare(password, organization.passwordHash))) throw new UnauthorizedException('Invalid email or password');
    return this.issue(organization);
  }
  async me(id: string) { const org = await this.prisma.organization.findUnique({ where: { id }, select: { id: true, name: true, email: true, createdAt: true } }); if (!org) throw new UnauthorizedException(); return org; }
  private issue(org: { id: string; email: string; name: string }) { return { accessToken: this.jwt.sign({ sub: org.id, email: org.email, name: org.name }), organization: { id: org.id, email: org.email, name: org.name } }; }
}
