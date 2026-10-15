export type ApplicationRole = 'club' | 'organizer';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationDecision = 'approve' | 'reject';
export type ApplicationFootballType =
  | ''
  | 'amateur'
  | 'professional'
  | 'halisaha';

export type AccountApplication = {
  userId: string;
  role: ApplicationRole;
  fullName: string;
  contactName: string;
  username: string;
  email: string;
  phone: string;
  district: string;
  footballType: ApplicationFootballType;
  note: string;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string;
};

export interface ApplicationsRepository {
  list(status: ApplicationStatus): Promise<AccountApplication[]>;
  decide(
    userId: string,
    decision: ApplicationDecision,
    reason: string,
  ): Promise<AccountApplication>;
}
