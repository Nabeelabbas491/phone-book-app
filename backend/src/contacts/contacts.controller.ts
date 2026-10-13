import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Contact } from './contact.entity';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { PaginatedContactsDto } from './dto/paginated-contacts.dto';
import { QueryContactsDto } from './dto/query-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedContactsDto })
  findAll(@Query() query: QueryContactsDto): Promise<PaginatedContactsDto> {
    return this.contactsService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Contact })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Contact> {
    return this.contactsService.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ type: Contact })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  create(@Body() dto: CreateContactDto): Promise<Contact> {
    return this.contactsService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Contact })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto): Promise<Contact> {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.contactsService.remove(id);
  }
}
