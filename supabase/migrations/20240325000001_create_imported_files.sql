create table if not exists imported_files (
    id uuid default uuid_generate_v4() primary key,
    company_id uuid references companies(id) on delete cascade,
    user_id uuid references auth.users(id),
    file_name text not null,
    file_type text not null check (file_type in ('bank', 'accounting')),
    file_path text not null,
    import_date timestamp with time zone default timezone('utc'::text, now()) not null,
    status text not null check (status in ('pending', 'processing', 'processed', 'error')),
    bank_account_id uuid references bank_accounts(id) on delete set null,
    row_count integer default 0,
    error_message text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Crear índices para búsquedas comunes
create index if not exists imported_files_company_id_idx on imported_files(company_id);
create index if not exists imported_files_bank_account_id_idx on imported_files(bank_account_id);
create index if not exists imported_files_status_idx on imported_files(status);

-- Trigger para actualizar updated_at
create trigger set_updated_at
    before update on imported_files
    for each row
    execute function public.set_updated_at(); 