import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';

/** Every property is optional; only the supplied fields are updated. */
export class UpdateContactDto extends PartialType(CreateContactDto) {}
