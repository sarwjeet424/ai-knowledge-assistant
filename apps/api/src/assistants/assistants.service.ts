import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class AssistantsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(orgId: string) { return this.prisma.assistant.findMany({ where:{organizationId:orgId}, select:{id:true,tokenHint:true,status:true,createdAt:true,updatedAt:true} }); }
  async create(orgId: string) { const token = this.token(); const assistant = await this.prisma.assistant.create({ data:{organizationId:orgId, tokenLookup:this.lookup(token), tokenHash:await bcrypt.hash(token,12), tokenHint:token.slice(-6)} }); return { ...assistant, token }; }
  async get(orgId:string,id:string){return this.ensure(orgId,id);}
  async regenerate(orgId: string, id: string) { await this.ensure(orgId,id); const token=this.token(); const assistant=await this.prisma.assistant.update({where:{id},data:{tokenLookup:this.lookup(token),tokenHash:await bcrypt.hash(token,12),tokenHint:token.slice(-6)}}); return { ...assistant, token }; }
  async ensure(orgId:string,id:string) { const assistant=await this.prisma.assistant.findFirst({where:{id,organizationId:orgId}}); if(!assistant) throw new NotFoundException('Assistant not found'); return assistant; }
  private token() { return `akda_${randomBytes(32).toString('base64url')}`; }
  private lookup(token:string){ return createHash('sha256').update(token).digest('hex'); }
}
