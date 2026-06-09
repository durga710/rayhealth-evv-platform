import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Search, Users } from 'lucide-react';
import { getJson, postJson } from '../../lib/api-client.js';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  medicaidNumber?: string;
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [medicaidNumber, setMedicaidNumber] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getJson<Client[]>('/api/clients')
      .then((data) => setClients(data || []))
      .catch(() => setClients([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.medicaidNumber ?? ''}`.toLowerCase().includes(q),
    );
  }, [clients, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const newClient = await postJson<Client>('/api/clients', {
        firstName,
        lastName,
        dateOfBirth,
        medicaidNumber,
      });
      setClients((prev) => [...prev, newClient]);
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setMedicaidNumber('');
      setMessage({ kind: 'ok', text: 'Client added successfully.' });
    } catch {
      setMessage({ kind: 'error', text: 'Failed to add client. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Client Management"
        description="Manage your clients and their demographic information."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" aria-hidden />
              Add New Client
            </CardTitle>
            <CardDescription>Create a client record for scheduling and EVV.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="medicaid">Medicaid Number (optional)</Label>
                <Input
                  id="medicaid"
                  value={medicaidNumber}
                  onChange={(e) => setMedicaidNumber(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Adding…' : 'Add Client'}
              </Button>
            </form>

            {message && (
              <div
                role="status"
                className={
                  message.kind === 'ok'
                    ? 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
                    : 'mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
                }
              >
                {message.text}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden />
                Client Roster
              </CardTitle>
              <CardDescription>
                {clients.length} {clients.length === 1 ? 'client' : 'clients'} on record
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
                placeholder="Search clients…"
                className="pl-9"
                aria-label="Search clients"
              />
            </div>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <EmptyState message="No clients found. Add one to get started." />
            ) : filtered.length === 0 ? (
              <EmptyState message={`No clients match “${query}”.`} />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead className="text-right">Medicaid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.firstName} {c.lastName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.dateOfBirth}</TableCell>
                        <TableCell className="text-right">
                          {c.medicaidNumber ? (
                            <Badge variant="secondary">{c.medicaidNumber}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
