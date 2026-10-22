import { copy } from '../../../shared/lib/copy';
import type {
  AccountApplicationInput,
  ApplicationRole,
  LoginInput,
  RegisterInput,
  SignUpRole,
} from '../domain/models';
import {
  declaredCoachLicenses,
  type DeclaredCoachLicense,
  type DeclaredLicenseStatus,
  type PlayerFootballType,
} from '../../../shared/domain/football';

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
export function validEmail(value: string) {
  return emailPattern.test(value) && value.length <= 254;
}
// A new password (reset or change) and its repetition; key names the field
// the server uses for the password.
export function validateNewPassword(
  password: string,
  repeat: string,
  key = 'password',
): FieldErrors {
  if (Array.from(password).length < 10) {
    return { [key]: copy.form.passwordError };
  }
  if (utf8Length(password) > 72) {
    return { [key]: copy.form.passwordMax };
  }
  if (password !== repeat) {
    return { repeat: copy.security.repeatError };
  }
  return {};
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
// The sign-up form before it is valid; players answer licenseStatus, coaches
// licenseLevel.
export type RegistrationDraft = {
  fullName: string;
  email: string;
  password: string;
  role: SignUpRole;
  footballType: PlayerFootballType | '';
  licenseStatus?: DeclaredLicenseStatus | '';
  licenseLevel?: DeclaredCoachLicense | '';
};
// Mirrors POST /v1/auth/register: only players and coaches sign up here.
export function validateRegistration(input: RegistrationDraft): FieldErrors {
  const fields = validateLogin({
    identifier: input.email,
    password: input.password,
  });
  delete fields.identifier;
  if (!emailPattern.test(input.email.trim())) {
    fields.email = copy.form.emailError;
  }
  if (input.role === 'player') {
    if (!['licensed', 'unlicensed'].includes(input.licenseStatus ?? '')) {
      fields.licenseStatus = copy.signUp.licenseStatusError;
    }
  } else if (input.role === 'coach') {
    if (
      !declaredCoachLicenses.includes(
        input.licenseLevel as DeclaredCoachLicense,
      )
    ) {
      fields.licenseLevel = copy.signUp.coachLicenseError;
    }
  } else {
    fields.role = copy.signUp.roleError;
  }
  if (!['amateur', 'professional', 'halisaha'].includes(input.footballType)) {
    fields.footballType = copy.signUp.footballTypeError;
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
// Builds the request body from a valid draft; each role sends only its own
// licence answer.
export function toRegisterInput(input: RegistrationDraft): RegisterInput {
  const base = {
    fullName: input.fullName,
    email: input.email.trim(),
    password: input.password,
    footballType: input.footballType as PlayerFootballType,
  };
  return input.role === 'coach'
    ? {
        ...base,
        role: 'coach',
        licenseLevel: input.licenseLevel as DeclaredCoachLicense,
      }
    : {
        ...base,
        role: 'player',
        licenseStatus: input.licenseStatus as DeclaredLicenseStatus,
      };
}

export type ApplicationDraft = {
  role: ApplicationRole;
  fullName: string;
  contactName: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  district: string;
  footballType: PlayerFootballType | '';
  note: string;
};
const usernamePattern = /^[a-z0-9._-]{3,32}$/;
const phonePattern = /^[0-9 +()-]*$/;
const footballTypes = ['amateur', 'professional', 'halisaha'];
function charLength(value: string) {
  return Array.from(value).length;
}
// Mirrors the POST /v1/auth/applications limits enforced by the server.
export function validateApplication(input: ApplicationDraft): FieldErrors {
  const fields: FieldErrors = {};
  const text = copy.application;
  if (input.role !== 'club') {
    fields.role = text.roleError;
  }
  const fullName = charLength(input.fullName.trim());
  if (fullName < 2 || fullName > 80) {
    fields.fullName = text.fullNameError;
  }
  const contactName = charLength(input.contactName.trim());
  if (contactName < 2 || contactName > 80) {
    fields.contactName = text.contactNameError;
  }
  if (!usernamePattern.test(input.username.trim())) {
    fields.username = text.usernameError;
  }
  const email = input.email.trim();
  if (email.length > 254 || !emailPattern.test(email)) {
    fields.email = copy.form.emailError;
  }
  if (!input.password) {
    fields.password = copy.form.passwordRequired;
  } else if (charLength(input.password) < 10) {
    fields.password = copy.form.passwordError;
  } else if (utf8Length(input.password) > 72) {
    fields.password = copy.form.passwordMax;
  }
  const phone = input.phone.trim();
  if (charLength(phone) > 30 || !phonePattern.test(phone)) {
    fields.phone = text.phoneError;
  }
  if (charLength(input.district.trim()) > 80) {
    fields.district = text.districtError;
  }
  if (!footballTypes.includes(input.footballType)) {
    fields.footballType = text.footballTypeError;
  }
  if (charLength(input.note.trim()) > 500) {
    fields.note = text.noteError;
  }
  return fields;
}
// Builds the request body; empty optional fields are left out.
export function toApplicationInput(
  input: ApplicationDraft,
): AccountApplicationInput {
  const body: AccountApplicationInput = {
    role: input.role,
    fullName: input.fullName.trim(),
    contactName: input.contactName.trim(),
    username: input.username.trim(),
    email: input.email.trim(),
    password: input.password,
  };
  const phone = input.phone.trim();
  const district = input.district.trim();
  const note = input.note.trim();
  if (phone) {
    body.phone = phone;
  }
  if (district) {
    body.district = district;
  }
  if (input.footballType) {
    body.footballType = input.footballType;
  }
  if (note) {
    body.note = note;
  }
  return body;
}
