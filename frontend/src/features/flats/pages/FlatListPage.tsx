/* FlatListPage.tsx — FE-05 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DataTable, type Column } from '@/components/data/DataTable';
import { FilterBar } from '@/components/data/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDebounce } from '@/lib/useDebounce';
import type { Flat } from '@/types/domain';

export default function FlatListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    setLoading(true);
    import('@/services/flatService').then(({ listFlats }) =>
      listFlats({ page, pageSize, search: debouncedSearch }).then((res) => {
        setData(res.items);
        setTotal(res.page.total);
        setLoading(false);
      }),
    ).catch(() => setLoading(false));
  }, [page, debouncedSearch]);

  const columns: Column<Flat>[] = [
    { key: 'flatNumber', header: 'Flat No', sortable: true },
    { key: 'wingName', header: 'Wing', sortable: true },
    { key: 'floor', header: 'Floor', sortable: true, align: 'right' },
    { key: 'flatTypeName', header: 'Type' },
    { key: 'ownerName', header: 'Owner' },
    { key: 'statusKey', header: 'Status', render: (r) => <StatusBadge statusKey={r.statusKey} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Flats"
        subtitle="Manage flat/unit master data"
        actions={<Button icon={<Icon name="plus" size={16} />} onClick={() => navigate('/flats/new')}>Add Flat</Button>}
      />
      <FilterBar>
        <Input placeholder="Search flats..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: '16rem' }} />
        <Select options={[{ value: '', label: 'All Wings' }]} style={{ maxWidth: '10rem' }} />
      </FilterBar>
      <DataTable columns={columns} data={data} loading={loading} onRowClick={(r) => navigate(`/flats/${r.flatId}`)} getRowId={(r) => r.flatId} />
      <Pagination page={{ page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasNext: page * pageSize < total, hasPrev: page > 1 }} onPageChange={setPage} />
    </div>
  );
}
