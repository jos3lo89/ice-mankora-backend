import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  floorIds: string[]; // IDs de los pisos donde estará disponible
}
