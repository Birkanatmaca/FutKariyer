import { copy } from '../../../shared/lib/copy';
import type { LoginInput, RegisterInput } from '../domain/models';

export type FieldErrors = Record<string, string>;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mirrors bcrypt's byte limit, including multi-byte Turkish characters.
function utf8Length(value: string) {
  return Array.from(value).reduce(
    (n, char) =>
      n +
      (char.codePointAt(0)! <= 0x7f
        ? 1
        : char.codePointAt(0)! <= 0x7ff
        ? 2
        : char.codePointAt(0)! <= 0xffff
        ? 3
        : 4),
    0,
  );
}
export function validateLogin(input: LoginInput): FieldErrors {
  const fields: FieldErrors = {};
  if (!input.identifier.trim() || input.identifier.trim().length > 254) {
    fields.identifier = copy.form.identifierError;
  }
  if (!input.password) {
    fields.password = copy.form.passwordRequired;
  }
  return fields;
}
export function validateRegistration(input: RegisterInput): FieldErrors {
  const fields = validateLogin({
    identifier: input.email,
    password: input.password,
  });
  delete fields.identifier;
  if (!emailPattern.test(input.email.trim())) {
    fields.email = copy.form.emailError;
  }
  if (input.role !== 'player') {
    fields.role = copy.signUp.playerOnly;
  }
  const nameLength = Array.from(input.fullName.trim()).length;
  if (nameLength < 2 || nameLength > 80) {
    fields.fullName = copy.form.nameError;
  }
  if (Array.from(input.password).length < 10) {
    fields.password = copy.form.passwordError;
  }
  if (utf8Length(input.password) > 72) {
    fields.password = copy.form.passwordMax;
  }
  return fields;
}
