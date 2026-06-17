import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ArenasService } from './arenas.service';

@ApiTags('arenas')
@Controller('arenas')
export class ArenasController {
  constructor(private readonly arenasService: ArenasService) {}

  // TODO: implement endpoints
}
