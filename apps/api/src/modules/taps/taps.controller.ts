import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TapsService } from './taps.service';

@ApiTags('taps')
@Controller('taps')
export class TapsController {
  constructor(private readonly tapsService: TapsService) {}

  // TODO: implement endpoints
}
