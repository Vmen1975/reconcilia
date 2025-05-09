create table if not exists bank_accounts (
    id uuid default uuid_generate_v4() primary key,
    company_id uuid references companies(id) on delete cascade,
    bank_name text not null,
    account_number text not null,
    account_type text not null,
    currency text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Crear índice para búsquedas por company_id
create index if not exists bank_accounts_company_id_idx on bank_accounts(company_id);

-- Trigger para actualizar updated_at
create trigger set_updated_at
    before update on bank_accounts
    for each row
    execute function public.set_updated_at(); 