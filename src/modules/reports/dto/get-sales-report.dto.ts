import { IsISO8601, IsOptional } from 'class-validator';

export class GetSalesReportDto {
  @IsOptional()
  @IsISO8601()
  startDate?: string; // Ejemplo: "2026-02-01"

  @IsOptional()
  @IsISO8601()
  endDate?: string; // Ejemplo: "2026-02-28"
}
