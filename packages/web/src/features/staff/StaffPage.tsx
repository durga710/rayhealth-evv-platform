import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Users, MailCheck, MailWarning, Copy, Check, Search } from 'lucide-react';
import { getJson, postJson, HttpError } from '../../lib/api-client.js';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StaffMember {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName?: string;
  lastName?: string;
}

interface InvitePublic {
  id: string;
  agencyId: string;
  email: string;
  role: string;
  status: string;
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  lastSentAt: string | null;
  createdAt: string | null;
  acceptanceUrl: string;
}

interface InviteCreateResponse {
  success: boolean;
  data: InvitePublic;
  emailSent: boolean;
  error?: string;
}

export function StaffPage(): React.ReactElement {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState('caregiver');
  const [latestInvite, setLatestInvite] = useState<InvitePublic | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const data = await getJson<StaffMember[]>('/api/staff');
        setStaff(Array.isArray(data) ? data : []);
      } catch {
        /* staff endpoint isn't critical for the invite flow */
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => `${s.email} ${s.role}`.toLowerCase().includes(q));
  }, [staff, query]);

  const handleInvite = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLatestInvite(null);
    setEmailSent(null);
    setCopyState('idle');
    setSubmitting(true);
    try {
      const response = await postJson<InviteCreateResponse>('/api/invites', {
        email,
        role,
        firstName: firstName || undefined,
      });
      if (!response.success || !response.data) {
        setError(response.error ?? 'Failed to create invite');
        return;
      }
      setLatestInvite(response.data);
      setEmailSent(response.emailSent);
      setStaff((prev) => [
        ...prev,
        { id: response.data.id, email: response.data.email, role: response.data.role, status: response.data.status },
      ]);
      setEmail('');
      setFirstName('');
    } catch (err) {
      if (err instanceof HttpError && err.body && typeof err.body === 'object') {
        const body = err.body as { error?: string };
        setError(body.error ?? `Request failed: ${err.status}`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send invite');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!latestInvite) return;
    try {
      await navigator.clipboard.writeText(latestInvite.acceptanceUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      /* fallthrough: user can manually select */
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff Management"
        description="Manage caregivers, coordinators, and invite new staff members."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" aria-hidden />
              Invite Staff Member
            </CardTitle>
            <CardDescription>Send a single-use invite link to onboard a teammate.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name (optional)</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Maria"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="caregiver">Caregiver</option>
                  <option value="coordinator">Coordinator</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Creating…' : 'Create Invite'}
              </Button>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {latestInvite && (
              <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  {emailSent === true && (
                    <Badge variant="success" className="gap-1">
                      <MailCheck className="size-3" aria-hidden /> Email sent
                    </Badge>
                  )}
                  {emailSent === false && (
                    <Badge variant="warning" className="gap-1">
                      <MailWarning className="size-3" aria-hidden /> Email not sent
                    </Badge>
                  )}
                </div>
                <p className="text-sm">
                  <strong>Invite created for {latestInvite.email}</strong>
                  {emailSent === false && ' — copy the link below and share it with them.'}
                </p>
                {emailSent === false && (
                  <p className="text-xs text-amber-700">
                    Email delivery is not currently configured. Set <code className="rounded bg-amber-100 px-1">RESEND_API_KEY</code> in
                    Vercel, then future invites will email automatically.
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-xs">
                    {latestInvite.acceptanceUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopy()}
                  >
                    {copyState === 'copied' ? (
                      <>
                        <Check className="size-3.5" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" aria-hidden /> Copy link
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(latestInvite.expiresAt).toLocaleString()} · Single-use — once
                  they accept, the link stops working.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                Active Staff Directory
              </CardTitle>
              <CardDescription>
                {staff.length} {staff.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-56">
              <Search
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search staff…"
                className="pl-9"
                aria-label="Search staff"
              />
            </div>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <EmptyState message="No staff found. Send an invite to add one." />
            ) : filtered.length === 0 ? (
              <EmptyState message={`No staff match “${query}”.`} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.email}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{s.role}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.status === 'pending' ? 'warning' : 'secondary'}>
                            {s.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Users className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
