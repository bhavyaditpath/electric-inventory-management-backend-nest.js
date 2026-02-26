import { Test, TestingModule } from '@nestjs/testing';
import { ReportCronService } from './report-cron.service';

describe('ReportCronService', () => {
  let service: ReportCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportCronService],
    }).compile();

    service = module.get<ReportCronService>(ReportCronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
