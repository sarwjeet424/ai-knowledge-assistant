import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export interface AuthenticatedOrganization { id: string; email: string; name: string }
export const CurrentOrg = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedOrganization => ctx.switchToHttp().getRequest().user);
