import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StarsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement business logic
}
