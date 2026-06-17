import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StarsService } from './stars.service';

@ApiTags('stars')
@Controller('stars')
export class StarsController {
  constructor(private readonly starsService: StarsService) {}

  // TODO: implement endpoints
}
