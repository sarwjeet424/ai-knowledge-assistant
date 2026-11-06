import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
export class RegisterDto { @IsString() @IsNotEmpty() @MaxLength(120) name!: string; @IsEmail() @MaxLength(254) email!: string; @IsString() @MinLength(8) @MaxLength(128) password!: string; }
export class LoginDto { @IsEmail() @MaxLength(254) email!: string; @IsString() @MinLength(8) @MaxLength(128) password!: string; }
