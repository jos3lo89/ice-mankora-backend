import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GetSalesReportDto } from './dto/get-sales-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}
  @Get('sales')
  async getSalesReport(@Query() query: GetSalesReportDto) {
    return this.reportsService.getSalesReport(query);
  }
}
