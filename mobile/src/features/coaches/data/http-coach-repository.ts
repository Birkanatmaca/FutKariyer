import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { staffPermissions } from '../../auth';
import {
  coachAvailabilities,
  coachSpecialties,
  licenseLevels,
  type CoachCard,
  type CoachMembership,
  type CoachProfile,
  type CoachRepository,
  type Person,
  type StaffCandidate,
  type StaffCard,
  type StaffList,
  type StaffMember,
} from '../domain/models';

const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];
const strings = (value: unknown) =>
  Array.isArray(value) && value.every(item => typeof item === 'string');
const date = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function isPerson(value: Person): boolean {
  return (
    !!value &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.verified === 'boolean' &&
    typeof value.district === 'string' &&
    Number.isInteger(value.avatarVersion)
  );
}

export function isCoachProfile(value: CoachProfile): boolean {
  return (
    !!value &&
    licenseLevels.includes(value.licenseLevel) &&
    strings(value.specialties) &&
    value.specialties.every(item => coachSpecialties.includes(item)) &&
    Number.isInteger(value.experienceYears) &&
    footballTypes.includes(value.footballType) &&
    coachAvailabilities.includes(value.availability) &&
    strings(value.pastClubs) &&
    !!value.visibility &&
    ['license', 'experience', 'football', 'clubs'].every(
      key => typeof value.visibility[key as 'license'] === 'boolean',
    )
  );
}

function grantValid(item: { role: string; permissions: string[] }) {
  return (
    coachSpecialties.includes(item.role as never) &&
    strings(item.permissions) &&
    item.permissions.every(p => staffPermissions.includes(p as never))
  );
}

function link(item: StaffMember | CoachMembership) {
  return (
    ['invited', 'active'].includes(item.status) &&
    grantValid(item) &&
    date(item.invitedAt) &&
    (item.joinedAt === null || date(item.joinedAt))
  );
}

function staffList(data: StaffList): StaffList {
  if (
    !data ||
    !Number.isInteger(data.limit) ||
    !Array.isArray(data.staff) ||
    !data.staff.every(
      m => isPerson(m.coach) && link(m) && isCoachProfile(m.profile),
    )
  ) {
    throw new ApiError(copy.form.unexpected);
  }
  return data;
}

function memberships(data: { clubs: CoachMembership[] }) {
  if (
    !data ||
    !Array.isArray(data.clubs) ||
    !data.clubs.every(m => isPerson(m.club) && link(m))
  ) {
    throw new ApiError(copy.form.unexpected);
  }
  return data.clubs;
}

function card(item: { role: string }) {
  return coachSpecialties.includes(item.role as never);
}

export const coachRepository: CoachRepository = {
  async profile(token) {
    const data = await request<{ profile: CoachProfile }>(
      '/v1/me/coach-profile',
      { token },
    );
    if (!isCoachProfile(data?.profile))
      throw new ApiError(copy.form.unexpected);
    return data.profile;
  },
  async saveProfile(token, profile) {
    const data = await request<{ profile: CoachProfile }>(
      '/v1/me/coach-profile',
      { method: 'PUT', token, body: profile },
    );
    if (!isCoachProfile(data?.profile))
      throw new ApiError(copy.form.unexpected);
    return data.profile;
  },
  async staff(token) {
    return staffList(await request<StaffList>('/v1/me/staff', { token }));
  },
  async candidates(token, query) {
    const data = await request<{ items: StaffCandidate[] }>(
      '/v1/me/staff/candidates?q=' + encodeURIComponent(query),
      { token },
    );
    if (
      !Array.isArray(data?.items) ||
      !data.items.every(c => isPerson(c.coach) && isCoachProfile(c.profile))
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.items;
  },
  async invite(token, coachId, grant) {
    return staffList(
      await request<StaffList>('/v1/me/staff', {
        method: 'POST',
        token,
        body: { coachId, ...grant },
      }),
    );
  },
  async update(token, coachId, grant) {
    return staffList(
      await request<StaffList>('/v1/me/staff/' + encodeURIComponent(coachId), {
        method: 'PUT',
        token,
        body: grant,
      }),
    );
  },
  async remove(token, coachId) {
    await request<void>('/v1/me/staff/' + encodeURIComponent(coachId), {
      method: 'DELETE',
      token,
    });
  },
  async memberships(token) {
    return memberships(await request('/v1/me/coach-clubs', { token }));
  },
  async respond(token, clubId, accept) {
    return memberships(
      await request('/v1/me/coach-clubs/' + encodeURIComponent(clubId), {
        method: 'PUT',
        token,
        body: { accept },
      }),
    );
  },
  async leave(token, clubId) {
    await request<void>('/v1/me/coach-clubs/' + encodeURIComponent(clubId), {
      method: 'DELETE',
      token,
    });
  },
  async clubStaff(token, clubId) {
    const data = await request<{ staff: StaffCard[] }>(
      '/v1/staff/clubs/' + encodeURIComponent(clubId),
      { token },
    );
    if (
      !Array.isArray(data?.staff) ||
      !data.staff.every(item => isPerson(item.coach) && card(item))
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.staff;
  },
  async coachCard(token, coachId) {
    const data = await request<CoachCard>(
      '/v1/staff/coaches/' + encodeURIComponent(coachId),
      { token },
    );
    if (
      !data ||
      typeof data.full !== 'boolean' ||
      !data.profile ||
      !Array.isArray(data.clubs) ||
      !data.clubs.every(item => isPerson(item.club) && card(item))
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return data;
  },
};
