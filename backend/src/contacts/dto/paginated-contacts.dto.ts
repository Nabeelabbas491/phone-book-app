import { ApiProperty } from '@nestjs/swagger';
import { Contact } from '../contact.entity';

export class PaginatedContactsDto {
  @ApiProperty({ type: [Contact] })
  data: Contact[];

  @ApiProperty({ description: 'Total number of contacts matching the query' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
