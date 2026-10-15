import { AlertCircle, Eye, Search, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Table } from '../../components/ui/Table';
import { ApiError } from '../../lib/api/client';
import type { UserRole } from '../../lib/api/auth.api';
import { listUsers, type UserRecord } from '../../lib/api/users.api';

const PAGE_SIZE = 20;
type RoleFilter = 'all' | UserRole;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const location = useLocation();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setLoadError('');
    setForbidden(false);

    listUsers(controller.signal)
      .then((result) => {
        if (active) setUsers(result);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        if (error instanceof ApiError && error.status === 403) {
          setForbidden(true);
          setLoadError('Your account does not have permission to view users. This page is restricted to administrators.');
        } else if (error instanceof ApiError && error.status === 401) {
          setLoadError('Sign in with a valid POS account to view users.');
        } else {
          setLoadError(error instanceof Error ? error.message : 'Could not load users.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const filteredUsers = useMemo(() => {
    const search = searchInput.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        search.length === 0 ||
        user.email.toLocaleLowerCase().includes(search) ||
        user.role.toLocaleLowerCase().includes(search);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, searchInput, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pageUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  function updateRole(value: RoleFilter) {
    setRoleFilter(value);
    setPage(1);
  }

  const isUnauthorized = forbidden || (loadError.includes('Sign in') && !forbidden);

  return (
    <section className="space-y-5">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-400">Access control</p>
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Users</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          View POS accounts and assigned roles. User administration is restricted by the backend to administrators.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Users size={19} /></span>
          <div><p className="text-xs text-slate-500">Accounts returned by server</p><p className="mt-0.5 text-lg font-semibold text-slate-900">{loading ? '—' : users.length.toLocaleString()}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700"><ShieldCheck size={19} /></span>
          <div><p className="text-xs text-slate-500">Access permission</p><p className="mt-0.5 text-sm font-semibold text-slate-900">Administrator only</p></div>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input aria-label="Search users" placeholder="Search email or role…" value={searchInput} onChange={(event) => updateSearch(event.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="user-role-filter">Filter by role</label>
          <Select id="user-role-filter" aria-label="Filter users by role" value={roleFilter} onChange={(event) => updateRole(event.target.value as RoleFilter)} className="min-w-36">
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </Select>
          <span className="whitespace-nowrap text-xs text-slate-500">{loading ? 'Loading…' : `${filteredUsers.length.toLocaleString()} users`}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Table headers={['User', 'Role', 'Created', 'Actions']} caption="POS user accounts">
          {loading ? (
            <tr><td colSpan={4}><FeedbackState tone="loading" title="Loading users" description="Fetching account details from the POS server." /></td></tr>
          ) : loadError ? (
            <tr><td colSpan={4}><FeedbackState
              tone="error"
              title={forbidden ? 'Administrator access required' : isUnauthorized ? 'Sign-in required' : 'Users could not be loaded'}
              description={loadError}
              action={isUnauthorized ? <Link to="/login" state={{ from: location }}><Button variant="secondary">Sign in</Button></Link> : <Button variant="secondary" onClick={() => setReloadToken((value) => value + 1)}>Retry</Button>}
            /></td></tr>
          ) : pageUsers.length === 0 ? (
            <tr><td colSpan={4}><FeedbackState tone="empty" title={searchInput || roleFilter !== 'all' ? 'No matching users' : 'No users found'} description={searchInput || roleFilter !== 'all' ? 'Adjust the search or role filter and try again.' : 'No accounts were returned by the user API.'} /></td></tr>
          ) : pageUsers.map((user) => (
            <tr key={user.id} className="text-sm text-slate-600">
              <td className="px-4 py-3.5 first:pl-5">
                <p className="font-medium text-slate-800">{user.email}</p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-400">{user.id}</p>
              </td>
              <td className="px-4 py-3.5"><StatusBadge tone={user.role === 'admin' ? 'info' : 'neutral'}>{user.role === 'admin' ? 'Admin' : 'User'}</StatusBadge></td>
              <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3.5 last:pr-5"><div className="flex justify-end"><button type="button" aria-label={`View ${user.email}`} title="View user details" onClick={() => setSelectedUser(user)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><Eye size={16} /></button></div></td>
            </tr>
          ))}
        </Table>
        {!loading && !loadError && filteredUsers.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <p>
          The Users API returns email, role, and timestamps only; it has no display name, active status, server-side search, or pagination. Search, role filtering, and pagination on this page are applied to the returned list in the browser. Creating, editing, deactivating, or deleting accounts is not supported by the Users API.
        </p>
      </div>

      <Modal open={selectedUser !== null} onClose={() => setSelectedUser(null)} title="User details" description={selectedUser?.email}>
        {selectedUser && (
          <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-medium text-slate-800">{selectedUser.email}</dd></div>
            <div><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1"><StatusBadge tone={selectedUser.role === 'admin' ? 'info' : 'neutral'}>{selectedUser.role === 'admin' ? 'Admin' : 'User'}</StatusBadge></dd></div>
            <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedUser.createdAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Last updated</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selectedUser.updatedAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">User ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-700">{selectedUser.id}</dd></div>
            <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              The API does not return passwords or account status. No password is requested, displayed, or stored on this page.
            </div>
          </dl>
        )}
      </Modal>
    </section>
  );
}
