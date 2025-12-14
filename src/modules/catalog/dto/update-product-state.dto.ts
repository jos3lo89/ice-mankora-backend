import { IsBoolean } from "class-validator";

export class UpdateProductState {
  @IsBoolean()
  isActive: boolean
}
