import { Test, TestingModule } from '@nestjs/testing';
import { CallLogsController } from './call-logs.controller';

describe('CallLogsController', () => {
  let controller: CallLogsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallLogsController],
    }).compile();

    controller = module.get<CallLogsController>(CallLogsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
