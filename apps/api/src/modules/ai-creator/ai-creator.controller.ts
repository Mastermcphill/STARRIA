import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiCreatorService } from './ai-creator.service';

@ApiTags('ai-creator')
@Controller('ai-creator')
export class AiCreatorController {
  constructor(private readonly aiCreatorService: AiCreatorService) {}

  // TODO: implement endpoints
}
