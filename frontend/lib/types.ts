export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactInput = Pick<Contact, 'firstName' | 'lastName' | 'phoneNumber'>;

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
