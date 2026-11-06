import { IsString, Length, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AskDto {
  @ApiProperty({ description: 'Public assistant token' })
  @IsString()
  @Length(10, 200)
  assistantToken!: string;

  @ApiProperty({ description: 'Question text', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  question!: string;
}
